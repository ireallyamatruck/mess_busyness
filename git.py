import os
import subprocess

def git_push_automation():
    """
    Automates the git add, commit, and push sequence.
    """
    # 1. Get the path to the local repository
    repo_path = input("Enter the full path to your local repository (e.g., /Users/yourname/my-project): ")
    
    # 2. Check if the path is valid
    if not os.path.isdir(repo_path):
        print(f"\n[ERROR] Path not found: {repo_path}")
        return

    # Change directory to the repository path
    os.chdir(repo_path)
    print(f"\nSuccessfully navigated to: {repo_path}")

    # 3. Get commit message
    commit_message = input("Enter a commit message (e.g., 'Initial commit' or 'Fix secret issue'): ")
    
    # --- Execute Git Commands ---

    try:
        # A. Stage all changes
        print("\n[STEP 1/3] Adding all files (git add .)...")
        subprocess.run(['git', 'add', '.'], check=True, capture_output=True, text=True)
        print("  ✅ All files staged.")

        # B. Create a commit
        print("\n[STEP 2/3] Creating commit...")
        subprocess.run(['git', 'commit', '-m', commit_message, '--allow-empty'], check=True, capture_output=True, text=True)
        print(f"  ✅ Commit created with message: '{commit_message}'")

        # C. Push the commit
        print("\n[STEP 3/3] Pushing to GitHub (git push -u origin main)...")
        
        # NOTE: Git will now pause and ask for your username and password (PAT).
        # We cannot automate this security step directly in the script for safety.
        # You MUST enter your GitHub username and your Personal Access Token (PAT).
        subprocess.run(['git', 'push', '-u', 'origin', 'main'], check=True)
        
        print("\n[SUCCESS] Push complete!")

    except subprocess.CalledProcessError as e:
        print(f"\n[ERROR] Git command failed.")
        print(f"  Command: {' '.join(e.cmd)}")
        print(f"  Stdout: {e.stdout.strip()}")
        print(f"  Stderr: {e.stderr.strip()}")
        
        if 'denied' in e.stderr:
            print("\n🚨 **Authentication Failed** 🚨")
            print("Please ensure that for the 'Password' prompt, you entered your **Personal Access Token (PAT)**, NOT your GitHub account password.")

# Run the automation
git_push_automation()
