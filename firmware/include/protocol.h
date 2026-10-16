#ifndef PROTOCOL_H
#define PROTOCOL_H

#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>

#define MAX_LINE_LEN 64
#define MIN_FREQ_HZ 1000
#define MAX_FREQ_HZ 50000

typedef enum {
    CMD_TYPE_NONE = 0,
    CMD_TYPE_PING,
    CMD_TYPE_SET,
    CMD_TYPE_ALLOFF,
    CMD_TYPE_STATUS,
    CMD_TYPE_INVALID
} CommandType;

typedef struct {
    CommandType type;
    char zone;           // 'A' or 'B'
    bool enable;         // true for 'on', false for 'off'
    uint32_t freq_hz;    // 1000 to 50000 Hz
    char error_reason[48];
} ParsedCommand;

typedef struct {
    bool zone_a_on;
    uint32_t zone_a_actual_hz;
    bool zone_b_on;
    uint32_t zone_b_actual_hz;
    uint32_t uptime_ms;
    bool failsafe;
} SystemStatus;

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Parses an ASCII command line.
 * @param line Input line buffer (null-terminated).
 * @param out_cmd Pointer to ParsedCommand destination struct.
 * @return true if command is valid, false if syntax/range error occurred.
 */
bool protocol_parse_line(const char *line, ParsedCommand *out_cmd);

/**
 * Formats a reply string for a parsed command or system status.
 * @param cmd Parsed command.
 * @param status Current system status (used for STATUS command).
 * @param out_buf Destination character buffer.
 * @param max_len Maximum length of destination buffer.
 * @return length of formatted reply.
 */
size_t protocol_format_reply(const ParsedCommand *cmd, const SystemStatus *status, char *out_buf, size_t max_len);

#ifdef __cplusplus
}
#endif

#endif // PROTOCOL_H
