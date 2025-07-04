import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  User, 
  Mail, 
  MapPin, 
  Calendar, 
  Camera, 
  Save, 
  X, 
  Loader2, 
  Search,
  AlertCircle,
  CheckCircle,
  Globe
} from 'lucide-react';
import { useProfile } from '../hooks/useProfile';
import { useAuth } from '../context/AuthContext';
import Toast from './Toast';
import CitySelector from './CitySelector';
import { validateProfileForm, ProfileFormData, ValidationErrors } from '../utils/profileValidation';

interface ProfileFormProps {
  onClose?: () => void;
  isModal?: boolean;
}

const ProfileForm: React.FC<ProfileFormProps> = ({ onClose, isModal = false }) => {
  const { user } = useAuth();
  const { profile, updateProfile, uploadAvatar } = useProfile();
  
  const [formData, setFormData] = useState<ProfileFormData>({
    full_name: '',
    email: '',
    age: '',
    city: '',
    city_lat: null,
    city_lng: null,
    avatar_url: ''
  });
  
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Initialize form data
  useEffect(() => {
    if (profile) {
      const birthDate = profile.birth_date ? new Date(profile.birth_date) : null;
      const age = birthDate ? new Date().getFullYear() - birthDate.getFullYear() : '';
      
      setFormData({
        full_name: profile.full_name || '',
        email: user?.email || '',
        age: age.toString(),
        city: profile.location || '',
        city_lat: (profile as any).city_lat || null,
        city_lng: (profile as any).city_lng || null,
        avatar_url: profile.avatar_url || ''
      });
    }
  }, [profile, user]);

  // Track unsaved changes
  useEffect(() => {
    if (profile) {
      const birthDate = profile.birth_date ? new Date(profile.birth_date) : null;
      const currentAge = birthDate ? new Date().getFullYear() - birthDate.getFullYear() : '';
      
      const hasChanges = 
        formData.full_name !== (profile.full_name || '') ||
        formData.age !== currentAge.toString() ||
        formData.city !== (profile.location || '');
      
      setHasUnsavedChanges(hasChanges);
    }
  }, [formData, profile]);

  const handleInputChange = (field: keyof ProfileFormData, value: string | number | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleCitySelect = (city: string, lat: number, lng: number) => {
    setFormData(prev => ({
      ...prev,
      city,
      city_lat: lat,
      city_lng: lng
    }));
    
    if (errors.city) {
      setErrors(prev => ({ ...prev, city: undefined }));
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      showToast('Please upload a JPG, PNG, or WebP image', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
      showToast('Image must be smaller than 5MB', 'error');
      return;
    }

    setUploadingAvatar(true);
    try {
      const { url, error } = await uploadAvatar(file);
      if (error) {
        showToast(error, 'error');
      } else if (url) {
        setFormData(prev => ({ ...prev, avatar_url: url }));
        showToast('Avatar updated successfully!', 'success');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const validationErrors = validateProfileForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      showToast('Please fix the errors below', 'error');
      return;
    }

    setLoading(true);
    try {
      // Calculate birth date from age
      const birthYear = new Date().getFullYear() - parseInt(formData.age);
      const birthDate = new Date(birthYear, 0, 1).toISOString().split('T')[0];

      const updateData = {
        full_name: formData.full_name,
        location: formData.city,
        birth_date: birthDate,
        city_lat: formData.city_lat,
        city_lng: formData.city_lng
      };

      const { error } = await updateProfile(updateData);
      if (error) {
        showToast(error, 'error');
      } else {
        showToast('Profile updated successfully!', 'success');
        setHasUnsavedChanges(false);
        if (onClose) {
          setTimeout(onClose, 1000);
        }
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        onClose?.();
      }
    } else {
      onClose?.();
    }
  };

  // Auto-fill city from geolocation
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by this browser', 'error');
      return;
    }

    showToast('Getting your location...', 'info');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          // Reverse geocoding to get city name
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`
          );
          const data = await response.json();
          
          if (data && data.address) {
            const city = data.address.city || data.address.town || data.address.village || data.display_name;
            handleCitySelect(city, latitude, longitude);
            showToast('Location detected successfully!', 'success');
          }
        } catch (error) {
          showToast('Failed to get city name from location', 'error');
        }
      },
      (error) => {
        showToast('Failed to get your location', 'error');
      }
    );
  };

  const containerClass = isModal 
    ? "bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
    : "bg-white rounded-2xl shadow-xl border border-gray-200";

  return (
    <>
      <div className={containerClass}>
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
              <User className="mr-3" size={24} />
              Edit Profile
            </h2>
            {isModal && (
              <button
                onClick={handleCancel}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            )}
          </div>
          <p className="text-gray-600 mt-2">Update your personal information and preferences</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg bg-gray-200">
                {formData.avatar_url ? (
                  <img
                    src={formData.avatar_url}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <User size={32} />
                  </div>
                )}
              </div>
              
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute bottom-0 right-0 bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600 transition-all disabled:opacity-50 shadow-lg"
              >
                {uploadingAvatar ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Camera size={16} />
                )}
              </button>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
            <p className="text-sm text-gray-500 text-center">
              Upload a profile picture (JPG, PNG, or WebP, max 5MB)
            </p>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Name */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => handleInputChange('full_name', e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    errors.full_name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter your full name"
                />
              </div>
              {errors.full_name && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle size={16} className="mr-1" />
                  {errors.full_name}
                </p>
              )}
            </div>

            {/* Email (Read-only) */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="email"
                  value={formData.email}
                  readOnly
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                  placeholder="Email address"
                />
              </div>
              <p className="mt-1 text-sm text-gray-500">Email cannot be changed</p>
            </div>

            {/* Age */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Age *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="number"
                  min="18"
                  max="120"
                  value={formData.age}
                  onChange={(e) => handleInputChange('age', e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    errors.age ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter your age"
                />
              </div>
              {errors.age && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle size={16} className="mr-1" />
                  {errors.age}
                </p>
              )}
            </div>

            {/* City Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City *
              </label>
              <CitySelector
                value={formData.city}
                onCitySelect={handleCitySelect}
                onGetCurrentLocation={handleGetCurrentLocation}
                error={errors.city}
              />
              {errors.city && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle size={16} className="mr-1" />
                  {errors.city}
                </p>
              )}
            </div>
          </div>

          {/* Map Preview */}
          {formData.city_lat && formData.city_lng && (
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location Preview
              </label>
              <div className="h-48 bg-gray-100 rounded-lg border border-gray-300 flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="mx-auto mb-2 text-blue-500" size={32} />
                  <p className="text-gray-600 font-medium">{formData.city}</p>
                  <p className="text-sm text-gray-500">
                    {formData.city_lat.toFixed(4)}, {formData.city_lng.toFixed(4)}
                  </p>
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${formData.city_lat}&mlon=${formData.city_lng}&zoom=12`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center mt-2 text-blue-600 hover:text-blue-800 text-sm"
                  >
                    <Globe size={14} className="mr-1" />
                    View on Map
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200">
            {isModal && (
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            )}
            
            <button
              type="submit"
              disabled={loading || !hasUnsavedChanges}
              className="flex-1 flex items-center justify-center px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={20} />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2" size={20} />
                  Save Changes
                </>
              )}
            </button>
          </div>

          {/* Validation Summary */}
          {Object.keys(errors).length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle className="text-red-500 mr-2 mt-0.5" size={20} />
                <div>
                  <h4 className="text-red-800 font-medium">Please fix the following errors:</h4>
                  <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                    {Object.values(errors).map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Success Indicator */}
          {!hasUnsavedChanges && formData.full_name && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="text-green-500 mr-2" size={20} />
                <p className="text-green-800">Profile is up to date!</p>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Toast Notifications */}
      {toast && <Toast message={toast.msg} type={toast.type} />}
    </>
  );
};

export default ProfileForm;