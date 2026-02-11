#!/usr/bin/env fish
# Breadcrumb Shell Integration — Fish
# Source this in your ~/.config/fish/config.fish:
#   source ~/.breadcrumb/shell-integration.fish

# Guard: don't load twice
if set -q __BREADCRUMB_SHELL_INTEGRATION
    exit
end
set -g __BREADCRUMB_SHELL_INTEGRATION 1

# OSC 133: Prompt start marker
function __breadcrumb_prompt_start --on-event fish_prompt
    printf '\033]133;A\007'
end

# OSC 7: Working directory reporting
function __breadcrumb_osc7 --on-event fish_prompt
    printf '\033]7;file://%s%s\033\\' (hostname) $PWD
end

# OSC 133: Command start marker
function __breadcrumb_preexec --on-event fish_preexec
    printf '\033]133;C\007'
end

# OSC 133: Command finished + prompt end markers
function __breadcrumb_postexec --on-event fish_postexec
    printf '\033]133;D;%s\007' $status
end
