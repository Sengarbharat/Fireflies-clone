from .conftest import SAMPLES


def test_seeded_library(client):
    body = client.get("/api/meetings").json()
    assert body["total"] == 8
    dates = [m["started_at"] for m in body["items"]]
    assert dates == sorted(dates, reverse=True)  # recency sort
    first = body["items"][0]
    assert first["participants"] and first["overview"]


def test_filters(client):
    by_tag = client.get("/api/meetings", params={"tag": "Hiring"}).json()
    assert by_tag["total"] >= 1 and all(any(t["name"] == "Hiring" for t in m["tags"]) for m in by_tag["items"])
    by_person = client.get("/api/meetings", params={"q": "rachel"}).json()
    assert by_person["total"] >= 1
    window = client.get("/api/meetings", params={"date_from": "2026-11-01", "date_to": "2026-11-30"}).json()
    assert all(m["started_at"] >= "2026-11-01" for m in window["items"])


def test_meeting_detail(client):
    mid = client.get("/api/meetings").json()["items"][0]["id"]
    m = client.get(f"/api/meetings/{mid}").json()
    starts = [s["start_ms"] for s in m["segments"]]
    assert starts == sorted(starts) and m["summary"]["overview"] and m["chapters"]
    assert abs(sum(s["talk_pct"] for s in m["speaker_stats"]) - 100) < 1


def test_global_search_highlights(client):
    res = client.get("/api/search", params={"q": "onboarding"}).json()
    assert res["total_meetings"] >= 2
    assert any("<mark>" in mt["snippet"] for r in res["results"] for mt in r["matches"])


def test_upload_vtt_creates_meeting_with_notes(client):
    with open(SAMPLES / "customer-call.vtt", "rb") as fh:
        r = client.post("/api/meetings/upload", files={"file": ("customer-call.vtt", fh, "text/vtt")},
                        data={"tags": "Customer"})
    assert r.status_code == 201, r.text
    m = r.json()
    assert m["source"] == "upload" and len(m["segments"]) >= 10
    assert m["summary"]["generated_by"] == "rules" and m["summary"]["keywords"]
    assert {p["name"] for p in m["participants"]} >= {s["speaker"]["name"] for s in m["segments"] if s["speaker"]}
    # new meeting is searchable through the FTS triggers
    word = m["segments"][0]["text"].split()[0].strip(",.")
    assert any(x["meeting_id"] == m["id"] for x in client.get("/api/search", params={"q": word}).json()["results"])


def test_meeting_crud_and_action_items(client):
    r = client.post("/api/meetings", json={
        "title": "Ad-hoc sync",
        "participants": [{"name": "Jane Doe", "email": "jane@example.com"}, {"name": "Sam Lee"}],
        "transcript_text": "[00:00:01] Jane Doe: I'll send the pricing deck by Friday.\n"
                           "[00:00:09] Sam Lee: Great, we need to finalize the SSO rollout plan next week.",
    })
    assert r.status_code == 201, r.text
    m = r.json()
    mid = m["id"]

    r = client.patch(f"/api/meetings/{mid}", json={"title": "Renamed sync", "tags": ["Planning"]})
    assert r.json()["title"] == "Renamed sync" and r.json()["tags"][0]["name"] == "Planning"

    sam = next(p for p in m["participants"] if p["name"] == "Sam Lee")
    item = client.post(f"/api/meetings/{mid}/action-items",
                       json={"text": "Book room", "assignee_id": sam["id"], "due_date": "2026-12-01"}).json()
    done = client.patch(f"/api/action-items/{item['id']}", json={"completed": True}).json()
    assert done["completed"] and done["completed_at"]
    cleared = client.patch(f"/api/action-items/{item['id']}", json={"assignee_id": None}).json()
    assert cleared["assignee"] is None and cleared["due_date"] == "2026-12-01"
    assert client.delete(f"/api/action-items/{item['id']}").status_code == 204

    seg_id = client.get(f"/api/meetings/{mid}").json()["segments"][0]["id"]
    c = client.post(f"/api/segments/{seg_id}/comments", json={"body": "nice"})
    assert c.status_code == 201

    assert client.delete(f"/api/meetings/{mid}").status_code == 204
    assert client.get(f"/api/meetings/{mid}").status_code == 404


def test_ask_and_export(client):
    mid = client.get("/api/meetings").json()["items"][0]["id"]
    a = client.post(f"/api/meetings/{mid}/ask", json={"question": "What are the action items?"}).json()
    assert "action items" in a["answer"].lower()
    a = client.post(f"/api/meetings/{mid}/ask", json={"question": "What did they say about pricing?"}).json()
    assert a["answer"]
    md = client.get(f"/api/meetings/{mid}/export", params={"format": "md"})
    assert md.status_code == 200 and md.text.startswith("# ")


def test_duration_platform_filters_and_bulk_delete(client):
    short = client.get("/api/meetings", params={"max_minutes": 13}).json()
    assert short["total"] >= 1 and all(m["duration_sec"] < 13 * 60 for m in short["items"])
    zoom = client.get("/api/meetings", params={"platform": "zoom"}).json()
    assert zoom["total"] >= 1 and all(m["platform"] == "zoom" for m in zoom["items"])

    ids = [client.post("/api/meetings", json={"title": f"Temp {i}"}).json()["id"] for i in range(2)]
    r = client.post("/api/meetings/bulk-delete", json={"ids": ids + [999999]})
    assert r.json() == {"deleted": 2}
    assert all(client.get(f"/api/meetings/{i}").status_code == 404 for i in ids)


def test_validation_errors(client):
    assert client.post("/api/meetings", json={"title": ""}).status_code == 422
    assert client.get("/api/meetings/999999").status_code == 404
    bad = client.post("/api/meetings/upload", files={"file": ("x.txt", b"   ", "text/plain")})
    assert bad.status_code == 422
