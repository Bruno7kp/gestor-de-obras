import React from 'react';
import { Users } from 'lucide-react';

interface ProjectMemberPreviewUser {
  id: string;
  name: string;
  email: string;
  profileImage: string | null;
  status: string;
}

interface ProjectMembersBadgeProps {
  users: ProjectMemberPreviewUser[];
  onClick: () => void;
  canEdit: boolean;
}

export const ProjectMembersBadge: React.FC<ProjectMembersBadgeProps> = ({
  users,
  onClick,
  canEdit,
}) => {
  const displayUsers = users.slice(0, 3);
  const remainingCount = users.length - 3;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
      title={canEdit ? 'Gerenciar membros do projeto' : 'Ver membros do projeto'}
    >
      <div className="flex items-center -space-x-2">
        {displayUsers.map((previewUser, index) => (
          <div
            key={previewUser.id}
            className="w-8 h-8 rounded-full border-2 border-white bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold relative"
            style={{ zIndex: displayUsers.length - index }}
            title={previewUser.name}
          >
            {previewUser.profileImage ? (
              <img
                src={previewUser.profileImage}
                alt={previewUser.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span>{previewUser.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
        ))}
        {remainingCount > 0 && (
          <div
            className="w-8 h-8 rounded-full border-2 border-white bg-gray-400 flex items-center justify-center text-white text-xs font-semibold"
            style={{ zIndex: 0 }}
            title={`+${remainingCount} mais`}
          >
            +{remainingCount}
          </div>
        )}
        {users.length === 0 && (
          <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-gray-400">
            <Users size={16} />
          </div>
        )}
      </div>
      <span className="text-sm text-gray-700 font-medium">Ver membros</span>
    </button>
  );
};
