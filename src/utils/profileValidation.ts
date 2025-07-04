export interface ProfileFormData {
  full_name: string;
  email: string;
  age: string;
  city: string;
  city_lat: number | null;
  city_lng: number | null;
  avatar_url: string;
}

export interface ValidationErrors {
  full_name?: string;
  email?: string;
  age?: string;
  city?: string;
  avatar_url?: string;
}

export const validateProfileForm = (data: ProfileFormData): ValidationErrors => {
  const errors: ValidationErrors = {};

  // Name validation
  if (!data.full_name.trim()) {
    errors.full_name = 'Name is required';
  } else if (data.full_name.trim().length < 2) {
    errors.full_name = 'Name must be at least 2 characters long';
  } else if (!/^[a-zA-Z\s'-]+$/.test(data.full_name.trim())) {
    errors.full_name = 'Name can only contain letters, spaces, hyphens, and apostrophes';
  }

  // Age validation
  if (!data.age.trim()) {
    errors.age = 'Age is required';
  } else {
    const ageNum = parseInt(data.age);
    if (isNaN(ageNum)) {
      errors.age = 'Age must be a valid number';
    } else if (ageNum < 18) {
      errors.age = 'You must be at least 18 years old';
    } else if (ageNum > 120) {
      errors.age = 'Please enter a valid age';
    }
  }

  // City validation
  if (!data.city.trim()) {
    errors.city = 'City is required';
  } else if (!data.city_lat || !data.city_lng) {
    errors.city = 'Please select a city from the suggestions';
  }

  return errors;
};

export const validateImageFile = (file: File): string | null => {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!validTypes.includes(file.type)) {
    return 'Please upload a JPG, PNG, or WebP image';
  }

  if (file.size > maxSize) {
    return 'Image must be smaller than 5MB';
  }

  return null;
};

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/\s+/g, ' ');
};

export const formatAge = (birthDate: string): number => {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
};

export const calculateBirthDate = (age: number): string => {
  const currentYear = new Date().getFullYear();
  const birthYear = currentYear - age;
  return new Date(birthYear, 0, 1).toISOString().split('T')[0];
};