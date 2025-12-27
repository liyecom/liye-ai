import os
import yaml
import argparse
from crewai import Agent, Task, Crew, Process
from dotenv import load_dotenv
from datetime import datetime
import json
from tools.sellersprite_tools import SellersSpriteTool, SellersSpriteReverseTool
from tools.qdrant_kb_tool import QdrantKnowledgeTool

# Load environment variables
load_dotenv()

# Check for API Key
if not os.getenv("ANTHROPIC_API_KEY"):
    print("Error: ANTHROPIC_API_KEY not found. Please check .env")
    exit(1)

# Model Name
claude_model_name = "anthropic/claude-sonnet-4-5-20250929"

def load_config(file_path):
    with open(file_path, 'r') as file:
        return yaml.safe_load(file)

def main():
    parser = argparse.ArgumentParser(description='Amazon Operations Crew v2.0')
    
    # Common Arguments
    parser.add_argument('--mode', type=str, choices=['launch', 'optimize'], default='launch', help='Operation Mode')
    parser.add_argument('--file_path', type=str, required=False, help='Path to Data File (Excel/CSV)')
    
    # Launch Mode Arguments
    parser.add_argument('--product', type=str, help='Product Name (Launch Mode)')
    parser.add_argument('--market', type=str, default='Amazon US', help='Target Market')
    parser.add_argument('--target_audience', type=str, default='General', help='Target Audience')
    
    # Optimize Mode Arguments
    parser.add_argument('--asin', type=str, help='Target ASIN (Optimize Mode)')

    args = parser.parse_args()

    # Load Shared Agents
    agents_config = load_config('config/agents.yaml')

    # --- MODE SELECTION ---
    if args.mode == 'launch':
        print(f"🚀 Starting Launch Mode for: {args.product}")
        tasks_config = load_config('config/tasks_launch.yaml')

        # Tools
        kb_tool = QdrantKnowledgeTool()  # Knowledge base for best practices
        ss_tool = SellersSpriteTool()
        sellersprite_tool = SellersSpriteTool() # New instance as per instruction

        # Agents (Reusing Keyword Analyst but with different task context if needed)
        analyst = Agent(config=agents_config['keyword_analyst'], tools=[kb_tool, ss_tool], llm=claude_model_name)
        optimizer = Agent(config=agents_config['listing_optimizer'], tools=[kb_tool], llm=claude_model_name)
        
        # New Agents as per instruction
        listing_diagnostician = Agent(
            config=agents_config['listing_optimizer'],
            tools=[sellersprite_tool],
            verbose=True
        )

        ppc_auditor = Agent(
            config=agents_config['keyword_analyst'],
            tools=[sellersprite_tool],
            verbose=True
        )
        
        # Tasks
        task1 = Task(config=tasks_config['keyword_discovery'], agent=analyst)
        task2 = Task(config=tasks_config['listing_optimization'], agent=optimizer, context=[task1])
        
        crew = Crew(agents=[analyst, optimizer], tasks=[task1, task2], verbose=True)
        
        inputs = {
            'product': args.product,
            'market': args.market,
            'target_audience': args.target_audience,
            'file_path': args.file_path
        }

    elif args.mode == 'optimize':
        print(f"🏥 Starting Optimization Mode for ASIN: {args.asin}")
        tasks_config = load_config('config/tasks_optimize.yaml')

        # Tools (Use Reverse Tool + Knowledge Base)
        kb_tool = QdrantKnowledgeTool()  # Knowledge base for optimization strategies
        ss_reverse_tool = SellersSpriteReverseTool()

        # Agents (Reusing Analyst for diagnosis)
        diagnostician = Agent(
            role="Amazon Listing Diagnostician", # Override role for clarity
            goal="Identify traffic gaps and wasted spend in existing listings",
            backstory="Expert in analyzing Reverse ASIN data to find missed opportunities.",
            tools=[kb_tool, ss_reverse_tool],
            llm=claude_model_name,
            verbose=True
        )
        
        # Tasks
        task_diag = Task(config=tasks_config['listing_diagnosis'], agent=diagnostician)
        task_ppc = Task(config=tasks_config['ppc_audit'], agent=diagnostician, context=[task_diag])
        
        crew = Crew(agents=[diagnostician], tasks=[task_diag, task_ppc], verbose=True)
        
        inputs = {
            'asin': args.asin,
            'file_path': args.file_path
        }

    # Execute
    result = crew.kickoff(inputs=inputs)
    print("######################")
    print(result)
    
    # --- Dynamic Output Handling ---
    timestamp = datetime.now().strftime("%Y%m%d_%H%M")
    
    # Define Output Directories
    base_dir = "reports"
    os.makedirs(f"{base_dir}/markdown", exist_ok=True)
    os.makedirs(f"{base_dir}/raw_data", exist_ok=True)

    # Determine Filename
    if args.mode == 'optimize' and args.asin:
        file_base = f"{args.asin}_{timestamp}"
    elif args.mode == 'launch' and args.product:
        safe_product = args.product.replace(" ", "_").replace("/", "-")
        file_base = f"Launch_{safe_product}_{timestamp}"
    else:
        file_base = f"Report_{timestamp}"

    # Save Result (Markdown)
    output_md = f"{base_dir}/markdown/{file_base}.md"
    with open(output_md, "w") as f:
        content = str(result)
        if hasattr(result, 'raw'):
            content = result.raw
        f.write(content)
        
    print(f"\n✅ Report Saved: {output_md}")
    
    # Note: Raw Data saving would ideally be handled inside the Tool or returned by it.
    # For now, we only save the final analysis report here.

if __name__ == "__main__":
    main()
