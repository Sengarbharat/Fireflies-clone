"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import { useInvalidate } from "@/lib/hooks";
import type { MeetingDetail, MeetingListItem } from "@/lib/types";
import { MeetingFields, type MeetingFieldValues, toLocalInput } from "./MeetingFields";

const fromMeeting = (m: MeetingListItem): MeetingFieldValues => ({
  title: m.title,
  date: toLocalInput(m.started_at),
  platform: m.platform,
  participants: m.participants.map((p) => p.name),
  tags: m.tags.map((t) => t.name),
});

export function EditMeetingModal({
  meeting,
  open,
  onClose,
  onSaved,
}: {
  meeting: MeetingListItem;
  open: boolean;
  onClose: () => void;
  onSaved?: (m: MeetingDetail) => void;
}) {
  const toast = useToast();
  const invalidate = useInvalidate();
  const [values, setValues] = useState(() => fromMeeting(meeting));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setValues(fromMeeting(meeting));
  }, [open, meeting]);

  const save = async () => {
    if (!values.title.trim()) return toast.error("Title can't be empty");
    setBusy(true);
    try {
      // Keep known emails when a participant's name is unchanged.
      const emailByName = new Map(meeting.participants.map((p) => [p.name, p.email]));
      const updated = await api.updateMeeting(meeting.id, {
        title: values.title.trim(),
        started_at: new Date(values.date).toISOString(),
        participants: values.participants.map((name) => ({ name, email: emailByName.get(name) ?? null })),
        tags: values.tags,
      });
      await invalidate();
      onSaved?.(updated);
      toast.success("Meeting updated");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save changes");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit meeting"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={save}>
            Save changes
          </Button>
        </>
      }
    >
      <MeetingFields values={values} onChange={setValues} showPlatform={false} />
    </Modal>
  );
}
