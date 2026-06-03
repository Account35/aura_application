-- Add cv_content column to profiles table to store uploaded CV text
ALTER TABLE profiles 
ADD COLUMN cv_content TEXT;