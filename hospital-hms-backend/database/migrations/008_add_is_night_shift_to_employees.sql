-- Adds `isNightShift` safely for both Prisma-style and legacy employee tables.
-- Safe to run multiple times.

DO $$
BEGIN
  -- Prisma default table name
  IF to_regclass('public."Employee"') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Employee'
        AND column_name = 'isNightShift'
    ) THEN
      ALTER TABLE public."Employee"
      ADD COLUMN "isNightShift" BOOLEAN NOT NULL DEFAULT false;
    END IF;
  END IF;

  -- Legacy/lowercase table name fallback
  IF to_regclass('public.employees') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'employees'
        AND column_name = 'is_night_shift'
    ) THEN
      ALTER TABLE public.employees
      ADD COLUMN is_night_shift BOOLEAN NOT NULL DEFAULT false;
    END IF;
  END IF;
END $$;
