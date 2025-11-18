import os
import sys
import markdown2
from weasyprint import HTML

def convert_md_to_pdf(input_file, output_file):
    with open(input_file, "r", encoding="utf-8") as f:
        md_text = f.read()

    html = markdown2.markdown(md_text)

    HTML(string=html).write_pdf(output_file)
    print(f"✅ Converted: {input_file} → {output_file}")

def convert_all(directory="."):
    md_files = [f for f in os.listdir(directory) if f.endswith(".md")]

    if not md_files:
        print("No .md files found.")
        return

    print(f"Found {len(md_files)} Markdown files. Converting...\n")

    for md in md_files:
        input_path = os.path.join(directory, md)
        output_path = os.path.join(directory, md.replace(".md", ".pdf"))
        convert_md_to_pdf(input_path, output_path)

    print("\n🎉 All done.")

if __name__ == "__main__":
    target_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    convert_all(target_dir)
