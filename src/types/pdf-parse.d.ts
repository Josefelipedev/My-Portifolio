declare module 'pdf-parse' {
  interface PDFParseOptions {
    verbosity?: number;
    data?: Buffer;
  }

  interface PDFParseTextResult {
    text: string;
  }

  class PDFParse {
    constructor(options?: PDFParseOptions);
    load(): Promise<void>;
    getText(): Promise<PDFParseTextResult>;
    destroy(): Promise<void>;
  }

  export { PDFParse };
}
