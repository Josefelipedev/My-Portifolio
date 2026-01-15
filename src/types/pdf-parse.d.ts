declare module 'pdf-parse' {
  interface PDFParseResult {
    text: string;
    numpages?: number;
    info?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    version?: string;
  }

  class PDFParse {
    constructor(options?: Record<string, unknown>);
    parseBuffer(buffer: Buffer): Promise<PDFParseResult>;
  }

  export { PDFParse };
}
