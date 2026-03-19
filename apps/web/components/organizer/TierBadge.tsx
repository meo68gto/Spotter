import type { OrganizerTier } from "@spotter/types";

interface TierBadgeProps {
  tier: OrganizerTier;
  size?: "sm" | "md" | "lg";
}

export function TierBadge({ tier, size = "md" }: TierBadgeProps) {
  const getTierStyles = (tier: OrganizerTier) => {
    const styles: Record<OrganizerTier, { bg: string; text: string; border: string; icon: string }> = {
      bronze: {
        bg: "bg-orange-100",
        text: "text-orange-800",
        border: "border-orange-200",
        icon: "🥉",
      },
      silver: {
        bg: "bg-gray-100",
        text: "text-gray-800",
        border: "border-gray-200",
        icon: "🥈",
      },
      gold: {
        bg: "bg-yellow-100",
        text: "text-yellow-800",
        border: "border-yellow-200",
        icon: "🥇",
      },
    };
    return styles[tier] || styles.bronze;
  };

  const getSizeStyles = (size: "sm" | "md" | "lg") => {
    const styles = {
      sm: {
        padding: "px-2 py-0.5",
        text: "text-xs",
        icon: "text-sm",
      },
      md: {
        padding: "px-2.5 py-0.5",
        text: "text-sm",
        icon: "text-base",
      },
      lg: {
        padding: "px-3 py-1",
        text: "text-base",
        icon: "text-lg",
      },
    };
    return styles[size];
  };

  const tierStyle = getTierStyles(tier);
  const sizeStyle = getSizeStyles(size);

  return (
    <span
      className={`inline-flex items-center rounded-full border ${tierStyle.bg} ${tierStyle.text} ${tierStyle.border} ${sizeStyle.padding} ${sizeStyle.text} font-medium`}
    >
      <span className={`mr-1 ${sizeStyle.icon}`}>{tierStyle.icon}</span>
      {tier.charAt(0).toUpperCase() + tier.slice(1)}
    </span>
  );
}
