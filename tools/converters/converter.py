import os
import sys
import json
from xmindparser import xmind_to_dict
from markitdown import MarkItDown

def xmind_to_markdown(file_path):
    """
    Convert XMind file to Markdown using xmindparser.
    Structure:
    - Root (H1)
      - Topic 1 (List item)
        - Subtopic (Nested list item)
    """
    try:
        content = xmind_to_dict(file_path)
        if not content:
            return "Error: Empty XMind file."
        
        # XMind usually contains a list of sheets, we take the first one usually
        sheet = content[0]
        root_topic = sheet.get('topic', {})
        
        md_lines = []
        
        # Helper function to recursively build markdown list
        def build_tree(topic, level=0):
            title = topic.get('title', 'Untitled')
            # Handle notes/comments if they exist (optional, simple implementation)
            note = topic.get('note', '')
            
            indent = "  " * level
            if level == 0:
                md_lines.append(f"# {title}\n")
            else:
                prefix = "- "
                md_lines.append(f"{indent}{prefix}{title}")
                if note:
                    # Clean up note newlines
                    clean_note = note.replace('\n', ' ').strip()
                    md_lines.append(f"{indent}  > *Note: {clean_note}*")
            
            # Process children
            topics = topic.get('topics', [])
            for child in topics:
                build_tree(child, level + 1 if level > 0 else 0) # Keep H1 as level 0, children start indent

        build_tree(root_topic)
        return "\n".join(md_lines)
        
    except Exception as e:
        return f"Error converting XMind: {str(e)}"

def convert_file(file_path):
    """
    Main conversion logic routing based on extension.
    """
    filename = os.path.basename(file_path)
    name, ext = os.path.splitext(filename)
    ext = ext.lower()
    
    output_path = os.path.join(os.path.dirname(file_path), f"{name}.md")
    
    if os.path.exists(output_path):
        print(f"  Skipping (Already exists): {filename}")
        return

    print(f"Processing: {filename} ...")
    
    md_content = ""
    
    try:
        if ext == '.xmind':
            md_content = xmind_to_markdown(file_path)
        elif ext in ['.pdf', '.docx', '.pptx', '.xlsx', '.html', '.csv', '.json', '.xml']:
            # Use MarkItDown for these formats
            md = MarkItDown()
            result = md.convert(file_path)
            if result and result.text_content:
                md_content = result.text_content
            else:
                print(f"  Warning: No content extracted from {filename}")
                return
        else:
            print(f"  Skipping unsupported format: {ext}")
            return

        if md_content.startswith("Error"):
             print(f"  Failed: {md_content}")
             return

        # Write to file
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(md_content)
        print(f"  Success -> {os.path.basename(output_path)}")
        
    except Exception as e:
        print(f"  Critical Error processing {filename}: {e}")

def main():
    if len(sys.argv) < 2:
        print("Usage: python converter.py <file_or_directory_path>")
        sys.exit(1)
        
    target_path = sys.argv[1]
    
    if os.path.isfile(target_path):
        convert_file(target_path)
    elif os.path.isdir(target_path):
        for root, dirs, files in os.walk(target_path):
            for file in files:
                # Filter for supported extensions
                if file.lower().endswith(('.xmind', '.pdf', '.docx', '.pptx', '.xlsx')):
                    full_path = os.path.join(root, file)
                    convert_file(full_path)
    else:
        print("Invalid path.")

if __name__ == "__main__":
    main()
