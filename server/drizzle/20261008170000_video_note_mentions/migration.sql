ALTER TABLE "note_references"
  DROP CONSTRAINT IF EXISTS "note_references_target_type_chk";

ALTER TABLE "note_references"
  ADD CONSTRAINT "note_references_target_type_chk"
  CHECK ("target_type" IN ('note', 'color', 'link', 'image', 'video'));
