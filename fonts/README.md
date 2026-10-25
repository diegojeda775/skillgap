# Fonts for PDF export

Resumes are converted to PDF by LibreOffice in the `gotenberg` container. It already includes
metric-compatible replacements for Calibri (Carlito), Cambria (Caladea), Arial/Helvetica
(Liberation Sans) and Times New Roman (Liberation Serif), so those look identical.

If your resume uses another font (Georgia, Garamond, Verdana, a Google font…), put its `.ttf` or
`.otf` files in this folder and restart the converter:

    docker compose up -d --force-recreate gotenberg

Only add fonts you're licensed to use on a server. Free alternatives: Gelasio matches Georgia's
spacing, EB Garamond replaces Garamond.
