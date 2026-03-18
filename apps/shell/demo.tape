# Neuro Shell — Marketing Team Demo
# Run: vhs demo.tape

Output ../../demo.gif
Set Shell "bash"
Set FontSize 14
Set Width 1200
Set Height 650
Set Theme "Catppuccin Mocha"
Set Padding 0
Set TypingSpeed 60ms
Set PlaybackSpeed 2
Env PS1 "$ "

Hide
Type "cd /Users/mihaiandreisoica/projects/praesidia_v3/neuro/apps/shell"
Enter
Type "../../node_modules/.bin/tsx --tsconfig tsconfig.json src/index.tsx --config examples/marketing-team.yaml"
Enter
Sleep 3s
Show

# Show agents
Type "/agents"
Enter
Sleep 2.5s

# Brand positioning
Type "@brand we're launching a B2B SaaS for AI agent management. Define our positioning in 3 bullet points."
Enter
Sleep 10s

# Growth viral loop
Type "@growth what's the fastest viral loop we can build for a developer tool?"
Enter
Sleep 9s

# Chain: content writes, SEO sharpens
Type "@content write a punchy homepage headline for an AI agent platform >> @seo"
Enter
Sleep 12s

# Swarm — all 10 weigh in
Type "/swarm"
Enter
Sleep 1s
Type "what's our single highest-leverage marketing move for launch week?"
Enter
Sleep 18s

Sleep 3s
