export function parseFileData(fileData) {
  if (!fileData) {
    throw new Error('File not found');
  }

  return {
    id: fileData._id,
    mongoId: fileData._id.toString(),
    filename: fileData.filename,
    contentType: fileData.contentType,
    length: fileData.length,
    createdAt: fileData.uploadDate ? fileData.uploadDate.toISOString() : '',
    updatedAt: fileData.uploadDate ? fileData.uploadDate.toISOString() : ''
  };
}

export class FileNotFoundError extends Error {
  /* istanbul ignore next */
  constructor() {
    super();
    this.name = 'FileNotFoundError';
  }
}
