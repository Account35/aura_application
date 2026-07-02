import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * PDF Text Extraction Edge Function
 * 
 * Architecture Overview:
 * This function implements a robust PDF text extraction system with multiple fallback strategies.
 * 
 * Key Design Decisions:
 * 1. Multi-Strategy Extraction: Uses two methods to handle various PDF formats
 *    - Method 1: Extracts from BT...ET content streams (standard PDF text)
 *    - Method 2: Fallback extraction from parentheses (handles edge cases)
 * 
 * 2. Error Handling: Implements granular error codes for better UX
 *    - INSUFFICIENT_TEXT: PDF is empty or scanned image
 *    - INVALID_FILE_TYPE: Non-PDF file uploaded
 *    - FILE_TOO_LARGE: Exceeds 1MB limit
 *    - EXTRACTION_FAILED: Generic extraction error
 * 
 * 3. Security: 
 *    - Validates authentication via Supabase Auth
 *    - Enforces file type and size limits
 *    - Sanitizes extracted text
 * 
 * 4. Text Validation:
 *    - Minimum 50 characters to ensure meaningful content
 *    - Filters out binary data and PDF commands
 *    - Handles escape sequences properly
 * 
 * Limitations:
 * - Does not support scanned PDFs (OCR would be needed)
 * - May struggle with heavily formatted or encrypted PDFs
 * - 1MB file size limit for performance
 * 
 * Future Improvements:
 * - Integrate OCR for scanned documents
 * - Support for encrypted PDFs
 * - Better handling of complex layouts and tables
 */

const buildCorsHeaders = (req: Request) => {
  const origin = req.headers.get('Origin');

  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
};

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      throw new Error('No file provided');
    }

    if (file.type !== 'application/pdf') {
      throw new Error('Only PDF files are supported');
    }

    if (file.size > 1024 * 1024) {
      throw new Error('File size must be less than 1MB');
    }

    // Read file as array buffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Enhanced PDF text extraction
    const text = extractTextFromPDF(uint8Array);

    if (!text || text.trim().length < 50) {
      throw new Error('INSUFFICIENT_TEXT');
    }

    return new Response(
      JSON.stringify({ text }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-pdf-text:', error);
    
    let errorMessage = 'Failed to extract text from PDF';
    let errorCode = 'EXTRACTION_FAILED';
    
    if (error.message === 'INSUFFICIENT_TEXT') {
      errorMessage = 'The PDF appears to be empty or contains insufficient text';
      errorCode = 'INSUFFICIENT_TEXT';
    } else if (error.message === 'Only PDF files are supported') {
      errorMessage = error.message;
      errorCode = 'INVALID_FILE_TYPE';
    } else if (error.message === 'File size must be less than 1MB') {
      errorMessage = error.message;
      errorCode = 'FILE_TOO_LARGE';
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage, code: errorCode }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractTextFromPDF(data: Uint8Array): string {
  try {
    // Convert to string for text extraction
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let pdfText = decoder.decode(data);

    // Method 1: Extract text from content streams (BT...ET blocks)
    let extractedText = '';
    const textRegex = /BT\s*([\s\S]*?)\s*ET/g;
    const matches = pdfText.matchAll(textRegex);
    
    for (const match of matches) {
      const content = match[1];
      
      // Extract text from Tj operators: (text)Tj
      const tjMatches = content.matchAll(/\(((?:[^()\\]|\\.)*)\)\s*Tj/g);
      for (const tjMatch of tjMatches) {
        let text = tjMatch[1];
        // Decode escape sequences
        text = text.replace(/\\n/g, '\n')
                   .replace(/\\r/g, '\r')
                   .replace(/\\t/g, '\t')
                   .replace(/\\\(/g, '(')
                   .replace(/\\\)/g, ')')
                   .replace(/\\\\/g, '\\');
        extractedText += text + ' ';
      }
      
      // Extract text from TJ operators: [(text1) (text2)]TJ
      const tjArrayMatches = content.matchAll(/\[((?:[^\[\]\\]|\\.)*)\]\s*TJ/g);
      for (const tjArrayMatch of tjArrayMatches) {
        const arrayContent = tjArrayMatch[1];
        const textInArray = arrayContent.matchAll(/\(((?:[^()\\]|\\.)*)\)/g);
        for (const textMatch of textInArray) {
          let text = textMatch[1];
          text = text.replace(/\\n/g, '\n')
                     .replace(/\\r/g, '\r')
                     .replace(/\\t/g, '\t')
                     .replace(/\\\(/g, '(')
                     .replace(/\\\)/g, ')')
                     .replace(/\\\\/g, '\\');
          extractedText += text + ' ';
        }
      }
    }

    // Method 2: Fallback - extract any text in parentheses (common in PDFs)
    if (extractedText.trim().length < 50) {
      const fallbackMatches = pdfText.matchAll(/\(([^)]{2,})\)/g);
      for (const match of fallbackMatches) {
        let text = match[1];
        // Filter out non-text content (binary data, commands)
        if (/^[a-zA-Z0-9\s.,;:!?'"@#$%&*()\-+=\[\]{}|<>\/\\]+$/.test(text)) {
          text = text.replace(/\\n/g, '\n')
                     .replace(/\\r/g, '\r')
                     .replace(/\\t/g, '\t')
                     .replace(/\\\(/g, '(')
                     .replace(/\\\)/g, ')')
                     .replace(/\\\\/g, '\\');
          extractedText += text + ' ';
        }
      }
    }

    // Clean up the extracted text
    extractedText = extractedText
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();

    // Validate we got meaningful text
    if (extractedText.length < 50) {
      throw new Error('INSUFFICIENT_TEXT');
    }

    return extractedText;
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('INSUFFICIENT_TEXT');
  }
}
