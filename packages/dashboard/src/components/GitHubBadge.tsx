import { Badge } from "./Badge";
import { GitHubLogo } from "./GitHubLogo";

interface GitHubBadgeProps {
  url: string;
  label: string;
}

export function GitHubBadge({ url, label }: GitHubBadgeProps) {
  return (
    <Badge
      href={url}
      bgColor="#24292e"
      hoverBgColor="#1b1f23"
      icon={<GitHubLogo className="w-4 h-4 text-white" />}
      label={label}
    />
  );
}
