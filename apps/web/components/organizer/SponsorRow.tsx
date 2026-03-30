interface SponsorRowProps {
  sponsor: {
    id: string;
    name: string;
    tier: "bronze" | "silver" | "gold" | "platinum";
    email: string;
    website?: string;
    logoUrl?: string;
    events: number;
    totalSpent: number;
    joinedAt: string;
    status: "active" | "inactive";
  };
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
}

export function SponsorRow({ sponsor, onEdit, onRemove }: SponsorRowProps) {
  const tierColors = {
    bronze: "bg-amber-100 text-amber-800",
    silver: "bg-gray-100 text-gray-800",
    gold: "bg-yellow-100 text-yellow-800",
    platinum: "bg-purple-100 text-purple-800",
  };

  const statusColors = {
    active: "bg-green-100 text-green-800",
    inactive: "bg-gray-100 text-gray-500",
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
            {sponsor.name.charAt(0)}
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900">{sponsor.name}</div>
            <div className="text-sm text-gray-500">{sponsor.email}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tierColors[sponsor.tier]}`}>
          {sponsor.tier.charAt(0).toUpperCase() + sponsor.tier.slice(1)}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {sponsor.website ? (
          <a href={sponsor.website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-900 text-sm">
            {sponsor.website.replace(/^https?:\/\//, "")}
          </a>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {sponsor.events}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        ${sponsor.totalSpent.toLocaleString()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[sponsor.status]}`}>
          {sponsor.status.charAt(0).toUpperCase() + sponsor.status.slice(1)}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {new Date(sponsor.joinedAt).toLocaleDateString()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <button
          onClick={() => onEdit(sponsor.id)}
          className="text-indigo-600 hover:text-indigo-900 mr-4"
        >
          Edit
        </button>
        <button
          onClick={() => onRemove(sponsor.id)}
          className="text-red-600 hover:text-red-900"
        >
          Remove
        </button>
      </td>
    </tr>
  );
}
