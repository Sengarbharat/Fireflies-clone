import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <ComingSoon
      title="Analytics"
      description="Conversation intelligence across your team's meetings."
      features={[
        { name: "Talk-time trends", detail: "Who speaks most, meeting over meeting." },
        { name: "Topic tracker", detail: "Track mentions of competitors, pricing or features." },
        { name: "Sentiment", detail: "Spot positive and negative moments in calls." },
      ]}
    />
  );
}
