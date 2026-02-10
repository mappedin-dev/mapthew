import { Badge } from "./Badge";
import { JiraLogo } from "./JiraLogo";

interface JiraBadgeProps {
  url: string;
  label: string;
}

export function JiraBadge({ url, label }: JiraBadgeProps) {
  return (
    <Badge
      href={url}
      bgColor="#0052CC"
      hoverBgColor="#0747A6"
      icon={<JiraLogo className="w-4 h-4 text-white" />}
      label={label}
    />
  );
}
