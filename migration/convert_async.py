import re
import sys

def convert_file(path):
    with open(path, encoding='utf-8') as f:
        content = f.read()

    original = content

    # Add ah import if missing
    if "require('../utils/asyncHandler')" not in content:
        content = content.replace(
            "const dbMod = require('../db/db');",
            "const dbMod = require('../db/db');\nconst { ah } = require('../utils/asyncHandler');"
        )

    # Wrap route handlers: router.METHOD('path', (req, res) => { ... becomes(async...
    # Match the opening signature
    pattern = re.compile(r"(router\.(get|post|put|delete)\([^,]+,\s*)\(req, res\) => \{")
    lines = content.split('\n')
    out_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]
        m = pattern.search(line)
        if m:
            # Replace opening
            new_line = pattern.sub(lambda mm: mm.group(1) + "ah(async (req, res) => {", line, count=1)
            out_lines.append(new_line)
            # Now find the matching closing brace for THIS handler by tracking depth
            depth = new_line.count('{') - new_line.count('}')
            i += 1
            while i < len(lines) and depth > 0:
                l = lines[i]
                depth += l.count('{') - l.count('}')
                # Add await before dbMod. calls if not already awaited
                l = re.sub(r'(?<!await )(\bdbMod\.(run|all|get|runBatch)\()', r'await \1', l)
                if depth == 0:
                    # This line closes the handler - it should be "});"
                    l = re.sub(r'^(\s*)\}\);(\s*)$', r'\1}));\2', l)
                out_lines.append(l)
                i += 1
            continue
        else:
            out_lines.append(line)
            i += 1

    content = '\n'.join(out_lines)

    if content != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Converted: {path}")
    else:
        print(f"No changes: {path}")

for path in sys.argv[1:]:
    convert_file(path)
