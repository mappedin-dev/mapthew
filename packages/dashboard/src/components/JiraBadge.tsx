import { Badge } from "./Badge";

interface JiraBadgeProps {
  url: string;
  label: string;
}

const JiraIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="white">
    <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0z"/>
  </svg>
);

export function JiraBadge({ url, label }: JiraBadgeProps) {
  return (
    <Badge
      href={url}
      bgColor="#0052CC"
      hoverBgColor="#0747A6"
      icon={<JiraIcon />}
      label={label}
    />
  );
}
