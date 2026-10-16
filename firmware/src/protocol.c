#include "protocol.h"
#include <stdio.h>
#include <string.h>
#include <ctype.h>
#include <stdlib.h>

static void str_to_upper(char *str) {
    while (*str) {
        *str = (char)toupper((unsigned char)*str);
        str++;
    }
}

static const char *skip_whitespace(const char *s) {
    while (*s && isspace((unsigned char)*s)) {
        s++;
    }
    return s;
}

bool protocol_parse_line(const char *line, ParsedCommand *out_cmd) {
    if (!line || !out_cmd) return false;

    memset(out_cmd, 0, sizeof(ParsedCommand));
    out_cmd->type = CMD_TYPE_INVALID;

    // Check line length limit (max 64 chars before newline)
    size_t len = 0;
    while (line[len] && line[len] != '\r' && line[len] != '\n') {
        len++;
        if (len > MAX_LINE_LEN) {
            snprintf(out_cmd->error_reason, sizeof(out_cmd->error_reason), "Line exceeds 64 chars");
            return false;
        }
    }

    // Copy to working buffer and strip trailing newline/carriage return
    char buf[MAX_LINE_LEN + 1];
    memcpy(buf, line, len);
    buf[len] = '\0';

    const char *p = skip_whitespace(buf);
    if (*p == '\0') {
        out_cmd->type = CMD_TYPE_NONE;
        return true; // Empty line ignored safely
    }

    // Tokenize first word (command verb)
    char verb[32];
    int read_count = 0;
    if (sscanf(p, "%31s%n", verb, &read_count) != 1) {
        snprintf(out_cmd->error_reason, sizeof(out_cmd->error_reason), "Malformed input");
        return false;
    }
    p += read_count;
    str_to_upper(verb);

    // 1. PING
    if (strcmp(verb, "PING") == 0) {
        p = skip_whitespace(p);
        if (*p != '\0') {
            snprintf(out_cmd->error_reason, sizeof(out_cmd->error_reason), "Unexpected argument for PING");
            return false;
        }
        out_cmd->type = CMD_TYPE_PING;
        return true;
    }

    // 2. ALLOFF
    if (strcmp(verb, "ALLOFF") == 0) {
        p = skip_whitespace(p);
        if (*p != '\0') {
            snprintf(out_cmd->error_reason, sizeof(out_cmd->error_reason), "Unexpected argument for ALLOFF");
            return false;
        }
        out_cmd->type = CMD_TYPE_ALLOFF;
        return true;
    }

    // 3. STATUS
    if (strcmp(verb, "STATUS") == 0) {
        p = skip_whitespace(p);
        if (*p != '\0') {
            snprintf(out_cmd->error_reason, sizeof(out_cmd->error_reason), "Unexpected argument for STATUS");
            return false;
        }
        out_cmd->type = CMD_TYPE_STATUS;
        return true;
    }

    // 4. SET <A|B> <on|off> <freqHz>
    if (strcmp(verb, "SET") == 0) {
        char zone_str[16];
        char state_str[16];
        char freq_str[32];

        p = skip_whitespace(p);
        if (sscanf(p, "%15s%n", zone_str, &read_count) != 1) {
            snprintf(out_cmd->error_reason, sizeof(out_cmd->error_reason), "Missing zone argument");
            return false;
        }
        p += read_count;
        str_to_upper(zone_str);

        if (strcmp(zone_str, "A") != 0 && strcmp(zone_str, "B") != 0) {
            snprintf(out_cmd->error_reason, sizeof(out_cmd->error_reason), "Zone must be A or B");
            return false;
        }
        out_cmd->zone = zone_str[0];

        p = skip_whitespace(p);
        if (sscanf(p, "%15s%n", state_str, &read_count) != 1) {
            snprintf(out_cmd->error_reason, sizeof(out_cmd->error_reason), "Missing state (on/off)");
            return false;
        }
        p += read_count;
        str_to_upper(state_str);

        if (strcmp(state_str, "ON") == 0) {
            out_cmd->enable = true;
        } else if (strcmp(state_str, "OFF") == 0) {
            out_cmd->enable = false;
        } else {
            snprintf(out_cmd->error_reason, sizeof(out_cmd->error_reason), "State must be ON or OFF");
            return false;
        }

        p = skip_whitespace(p);
        if (sscanf(p, "%31s%n", freq_str, &read_count) != 1) {
            snprintf(out_cmd->error_reason, sizeof(out_cmd->error_reason), "Missing frequency");
            return false;
        }
        p += read_count;

        // Check for trailing garbage
        p = skip_whitespace(p);
        if (*p != '\0') {
            snprintf(out_cmd->error_reason, sizeof(out_cmd->error_reason), "Trailing characters after frequency");
            return false;
        }

        // Validate frequency digits
        for (int i = 0; freq_str[i] != '\0'; i++) {
            if (!isdigit((unsigned char)freq_str[i])) {
                snprintf(out_cmd->error_reason, sizeof(out_cmd->error_reason), "Invalid frequency format");
                return false;
            }
        }

        long f = strtol(freq_str, NULL, 10);
        if (f < MIN_FREQ_HZ || f > MAX_FREQ_HZ) {
            snprintf(out_cmd->error_reason, sizeof(out_cmd->error_reason), "Frequency out of range [1000..50000]");
            return false;
        }

        out_cmd->freq_hz = (uint32_t)f;
        out_cmd->type = CMD_TYPE_SET;
        return true;
    }

    snprintf(out_cmd->error_reason, sizeof(out_cmd->error_reason), "Unknown command");
    return false;
}

size_t protocol_format_reply(const ParsedCommand *cmd, const SystemStatus *status, char *out_buf, size_t max_len) {
    if (!cmd || !out_buf || max_len == 0) return 0;

    switch (cmd->type) {
        case CMD_TYPE_PING:
            return (size_t)snprintf(out_buf, max_len, "OK PING\n");

        case CMD_TYPE_ALLOFF:
            return (size_t)snprintf(out_buf, max_len, "OK ALLOFF\n");

        case CMD_TYPE_SET:
            return (size_t)snprintf(out_buf, max_len, "OK SET %c %s %lu\n",
                                    cmd->zone, cmd->enable ? "on" : "off", (unsigned long)cmd->freq_hz);

        case CMD_TYPE_STATUS:
            if (!status) return 0;
            return (size_t)snprintf(out_buf, max_len,
                                    "STATUS A=%d,%lu B=%d,%lu uptime=%lu failsafe=%d\n",
                                    status->zone_a_on ? 1 : 0, (unsigned long)status->zone_a_actual_hz,
                                    status->zone_b_on ? 1 : 0, (unsigned long)status->zone_b_actual_hz,
                                    (unsigned long)status->uptime_ms, status->failsafe ? 1 : 0);

        case CMD_TYPE_INVALID:
        default:
            return (size_t)snprintf(out_buf, max_len, "ERR %s\n",
                                    cmd->error_reason[0] ? cmd->error_reason : "syntax error");
    }
}
