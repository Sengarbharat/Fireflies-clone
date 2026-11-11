import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata = { title: "Team" };

export default function TeamPage() {
  return (
    <ComingSoon
      title="Team"
      description="Invite teammates and share meeting notes."
      features={[
        { name: "Invite members", detail: "Add teammates to your workspace." },
        { name: "Shared channels", detail: "Organize meetings into shared folders." },
        { name: "Permissions", detail: "Control who can view transcripts and recordings." },
      ]}
    />
  );
}
