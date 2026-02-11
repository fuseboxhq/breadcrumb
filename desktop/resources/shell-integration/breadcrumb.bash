#!/bin/bash
# Breadcrumb Shell Integration — Bash
# Source this in your ~/.bashrc:
#   [[ -f ~/.breadcrumb/shell-integration.bash ]] && source ~/.breadcrumb/shell-integration.bash

# Guard: don't load twice
if [[ -n "${__BREADCRUMB_SHELL_INTEGRATION:-}" ]]; then
    return 2>/dev/null || exit
fi
__BREADCRUMB_SHELL_INTEGRATION=1

# OSC 133: Command boundary markers
# A = prompt start, B = prompt end, C = command start, D = command end
__breadcrumb_precmd() {
    local exit_code=$?
    # Command finished (D) with exit code
    printf '\033]133;D;%s\007' "$exit_code"
    # Report working directory (OSC 7)
    printf '\033]7;file://%s%s\033\\' "$HOSTNAME" "$PWD"
    # Prompt start (A)
    printf '\033]133;A\007'
}

__breadcrumb_preexec() {
    # Command start (C)
    printf '\033]133;C\007'
}

# Hook into bash

# Set up PROMPT_COMMAND for precmd
if [[ -z "${PROMPT_COMMAND:-}" ]]; then
    PROMPT_COMMAND="__breadcrumb_precmd"
else
    PROMPT_COMMAND="__breadcrumb_precmd;${PROMPT_COMMAND}"
fi

# Append prompt end marker (B) to PS1
PS1="${PS1}"$'\001\033]133;B\007\002'

# Set up preexec via bash-preexec if available, otherwise use DEBUG trap
if [[ -n "${bash_preexec_imported:-}" ]] || type preexec_functions &>/dev/null 2>&1; then
    preexec_functions+=(__breadcrumb_preexec)
else
    # Fallback: use DEBUG trap for preexec behavior
    __breadcrumb_debug_trap() {
        # Only fire once per command (not for PROMPT_COMMAND itself)
        if [[ "${BASH_COMMAND}" != "__breadcrumb_precmd"* ]] && [[ -z "${__breadcrumb_in_precmd:-}" ]]; then
            __breadcrumb_preexec
            __breadcrumb_in_precmd=1
        fi
    }

    # Reset flag in precmd
    __breadcrumb_original_precmd="$PROMPT_COMMAND"
    PROMPT_COMMAND="__breadcrumb_in_precmd=;__breadcrumb_precmd;${__breadcrumb_original_precmd}"

    trap '__breadcrumb_debug_trap' DEBUG
fi
