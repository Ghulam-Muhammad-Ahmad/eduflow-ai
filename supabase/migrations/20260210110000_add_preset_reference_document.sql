-- Add optional reference document to checker presets (Document Center document)
ALTER TABLE checker_presets
ADD COLUMN IF NOT EXISTS reference_document_id uuid REFERENCES documents(id) ON DELETE SET NULL;

COMMENT ON COLUMN checker_presets.reference_document_id IS 'Optional reference document from Document Center (documents table) for grading context';