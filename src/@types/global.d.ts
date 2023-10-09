export {};

declare global {
  type FormData = import('formdata-node').FormData;
  type File = import('formdata-node').File;

  var File: File;
  // var Blob: Blob;
}
