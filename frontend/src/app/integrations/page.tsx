import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata = { title: "Integrations" };

export default function IntegrationsPage() {
  return (
    <ComingSoon
      title="Integrations"
      description="Connect your calendar, meeting tools and CRM."
      features={[
        { name: "Zoom", detail: "Auto-join and record Zoom meetings." },
        { name: "Google Meet", detail: "Capture Meet calls from your calendar." },
        { name: "Microsoft Teams", detail: "Join Teams meetings automatically." },
        { name: "Google Calendar", detail: "Pick which events the notetaker joins." },
        { name: "Salesforce & HubSpot", detail: "Log notes and action items to CRM records." },
        { name: "Slack", detail: "Post meeting recaps to a channel." },
      ]}
    />
  );
}
