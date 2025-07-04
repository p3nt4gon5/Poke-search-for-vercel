import React from 'react';
import { X } from 'lucide-react';
import ProfileForm from './ProfileForm';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <ProfileForm onClose={onClose} isModal={true} />
      </div>
    </div>
  );
};

export default ProfileModal;