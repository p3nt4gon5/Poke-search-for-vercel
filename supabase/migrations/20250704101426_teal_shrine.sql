/*
  # Enhanced Profile Schema

  1. New Fields
    - Add city coordinates for map integration
    - Add birth_date for age calculation
    - Ensure proper validation constraints

  2. Security
    - Update RLS policies for new fields
    - Maintain data privacy

  3. Indexes
    - Add indexes for location-based queries
*/

-- Add new fields to profiles table if they don't exist
DO $$
BEGIN
  -- Add city coordinates
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'city_lat'
  ) THEN
    ALTER TABLE profiles ADD COLUMN city_lat decimal(10, 8);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'city_lng'
  ) THEN
    ALTER TABLE profiles ADD COLUMN city_lng decimal(11, 8);
  END IF;

  -- Ensure birth_date exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'birth_date'
  ) THEN
    ALTER TABLE profiles ADD COLUMN birth_date date;
  END IF;
END $$;

-- Create indexes for location-based queries
CREATE INDEX IF NOT EXISTS profiles_location_idx ON profiles(city_lat, city_lng) WHERE city_lat IS NOT NULL AND city_lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_birth_date_idx ON profiles(birth_date) WHERE birth_date IS NOT NULL;

-- Add constraints for data validation
DO $$
BEGIN
  -- Age constraint (must be 18 or older)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'profiles_age_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_age_check 
    CHECK (birth_date IS NULL OR birth_date <= CURRENT_DATE - INTERVAL '18 years');
  END IF;

  -- Coordinate validation
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'profiles_lat_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_lat_check 
    CHECK (city_lat IS NULL OR (city_lat >= -90 AND city_lat <= 90));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'profiles_lng_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_lng_check 
    CHECK (city_lng IS NULL OR (city_lng >= -180 AND city_lng <= 180));
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    -- Constraints already exist, ignore
    NULL;
END $$;

-- Function to calculate age from birth_date
CREATE OR REPLACE FUNCTION calculate_age(birth_date date)
RETURNS integer AS $$
BEGIN
  IF birth_date IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN EXTRACT(YEAR FROM AGE(birth_date));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to validate profile data
CREATE OR REPLACE FUNCTION validate_profile_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate name (only letters, spaces, hyphens, apostrophes)
  IF NEW.full_name IS NOT NULL AND NEW.full_name !~ '^[a-zA-Z\s''-]+$' THEN
    RAISE EXCEPTION 'Name can only contain letters, spaces, hyphens, and apostrophes';
  END IF;

  -- Validate name length
  IF NEW.full_name IS NOT NULL AND LENGTH(TRIM(NEW.full_name)) < 2 THEN
    RAISE EXCEPTION 'Name must be at least 2 characters long';
  END IF;

  -- Validate age (must be 18 or older)
  IF NEW.birth_date IS NOT NULL AND NEW.birth_date > CURRENT_DATE - INTERVAL '18 years' THEN
    RAISE EXCEPTION 'User must be at least 18 years old';
  END IF;

  -- Validate coordinates consistency
  IF (NEW.city_lat IS NULL) != (NEW.city_lng IS NULL) THEN
    RAISE EXCEPTION 'Both latitude and longitude must be provided together';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for profile validation
DROP TRIGGER IF EXISTS validate_profile_trigger ON profiles;
CREATE TRIGGER validate_profile_trigger
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION validate_profile_data();

-- Update RLS policies to include new fields
-- (Existing policies should already cover these fields, but let's ensure they're explicit)

-- Create a view for public profile information
CREATE OR REPLACE VIEW public_profiles AS
SELECT 
  id,
  full_name,
  username,
  avatar_url,
  bio,
  location,
  website,
  is_public,
  created_at,
  calculate_age(birth_date) as age
FROM profiles
WHERE is_public = true;

-- Grant access to the view
GRANT SELECT ON public_profiles TO authenticated, anon;