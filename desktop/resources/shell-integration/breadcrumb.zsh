#!/bin/zsh
# Breadcrumb Shell Integration — Zsh
# Source this in your ~/.zshrc:
#   [[ -f ~/.breadcrumb/shell-integration.zsh ]] && source ~/.breadcrumb/shell-integration.zsh

# Guard: don't load twice
if [[ -n "${__BREADCRUMB_SHELL_INTEGRATION:-}" ]]; then
    return
fi
__BREADCRUMB_SHELL_INTEGRATION=1

# OSC 133: Command boundary markers
__breadcrumb_precmd() {
    local exit_code=$?
    # Command finished (D) with exit code
    printf '\033]133;D;%s\007' "$exit_code"
    # Report working directory (OSC 7)
    printf '\033]7;file://%s%s\033\\' "$HOST" "$PWD"
}

__breadcrumb_preexec() {
    # Command start (C)
    printf '\033]133;C\007'
}

# Register hooks (append, don't replace)
if [[ ${precmd_functions[(ie)__breadcrumb_precmd]} -gt ${#precmd_functions} ]]; then
    precmd_functions+=(__breadcrumb_precmd)
fi

if [[ ${preexec_functions[(ie)__breadcrumb_preexec]} -gt ${#preexec_functions} ]]; then
    preexec_functions+=(__breadcrumb_preexec)
fi

# Add OSC 133 markers to PS1
# A = prompt start (before prompt), B = prompt end (after prompt, before input)
PS1=$'%{\033]133;A\007%}'"${PS1}"$'%{\033]133;B\007%}'
