#include <stdio.h>
#include <string.h>
#include <unity.h>
#include "protocol.h"
#include "../../src/protocol.c"

void setUp(void) {}
void tearDown(void) {}

void test_valid_commands(void) {
    ParsedCommand cmd;

    // 1. PING
    TEST_ASSERT_TRUE(protocol_parse_line("PING\n", &cmd));
    TEST_ASSERT_EQUAL(CMD_TYPE_PING, cmd.type);

    // 2. ALLOFF
    TEST_ASSERT_TRUE(protocol_parse_line("ALLOFF\r\n", &cmd));
    TEST_ASSERT_EQUAL(CMD_TYPE_ALLOFF, cmd.type);

    // 3. STATUS
    TEST_ASSERT_TRUE(protocol_parse_line("STATUS\n", &cmd));
    TEST_ASSERT_EQUAL(CMD_TYPE_STATUS, cmd.type);

    // 4. SET A on 40000
    TEST_ASSERT_TRUE(protocol_parse_line("SET A on 40000\n", &cmd));
    TEST_ASSERT_EQUAL(CMD_TYPE_SET, cmd.type);
    TEST_ASSERT_EQUAL('A', cmd.zone);
    TEST_ASSERT_TRUE(cmd.enable);
    TEST_ASSERT_EQUAL(40000, cmd.freq_hz);

    // 5. SET B off 3000
    TEST_ASSERT_TRUE(protocol_parse_line("SET B off 3000\n", &cmd));
    TEST_ASSERT_EQUAL(CMD_TYPE_SET, cmd.type);
    TEST_ASSERT_EQUAL('B', cmd.zone);
    TEST_ASSERT_FALSE(cmd.enable);
    TEST_ASSERT_EQUAL(3000, cmd.freq_hz);
}

void test_case_insensitivity_and_whitespace(void) {
    ParsedCommand cmd;

    // Mixed case and extra spaces
    TEST_ASSERT_TRUE(protocol_parse_line("   seT   a   ON   40000   \n", &cmd));
    TEST_ASSERT_EQUAL(CMD_TYPE_SET, cmd.type);
    TEST_ASSERT_EQUAL('A', cmd.zone);
    TEST_ASSERT_TRUE(cmd.enable);
    TEST_ASSERT_EQUAL(40000, cmd.freq_hz);

    TEST_ASSERT_TRUE(protocol_parse_line("ping\n", &cmd));
    TEST_ASSERT_EQUAL(CMD_TYPE_PING, cmd.type);

    TEST_ASSERT_TRUE(protocol_parse_line("sTaTuS\n", &cmd));
    TEST_ASSERT_EQUAL(CMD_TYPE_STATUS, cmd.type);
}

void test_bad_numbers_and_ranges(void) {
    ParsedCommand cmd;

    // Below 1000 Hz
    TEST_ASSERT_FALSE(protocol_parse_line("SET A on 999\n", &cmd));
    TEST_ASSERT_NOT_NULL(strstr(cmd.error_reason, "out of range"));

    // Above 50000 Hz
    TEST_ASSERT_FALSE(protocol_parse_line("SET A on 50001\n", &cmd));
    TEST_ASSERT_NOT_NULL(strstr(cmd.error_reason, "out of range"));

    // Alphabetic / non-digit characters in frequency
    TEST_ASSERT_FALSE(protocol_parse_line("SET A on 40000Hz\n", &cmd));
    TEST_ASSERT_FALSE(protocol_parse_line("SET A on 40k\n", &cmd));
    TEST_ASSERT_FALSE(protocol_parse_line("SET A on -3000\n", &cmd));

    // Invalid zone
    TEST_ASSERT_FALSE(protocol_parse_line("SET C on 40000\n", &cmd));
    TEST_ASSERT_NOT_NULL(strstr(cmd.error_reason, "Zone must be A or B"));

    // Invalid state
    TEST_ASSERT_FALSE(protocol_parse_line("SET A enable 40000\n", &cmd));
}

void test_too_long_and_empty_lines(void) {
    ParsedCommand cmd;

    // Empty line
    TEST_ASSERT_TRUE(protocol_parse_line("\n", &cmd));
    TEST_ASSERT_EQUAL(CMD_TYPE_NONE, cmd.type);

    // Line longer than 64 characters
    char long_line[100];
    memset(long_line, 'A', 80);
    long_line[80] = '\n';
    long_line[81] = '\0';

    TEST_ASSERT_FALSE(protocol_parse_line(long_line, &cmd));
    TEST_ASSERT_NOT_NULL(strstr(cmd.error_reason, "exceeds 64 chars"));
}

void test_formatting_replies(void) {
    char reply[128];
    ParsedCommand cmd;
    SystemStatus status = {
        .zone_a_on = true,
        .zone_a_actual_hz = 40000,
        .zone_b_on = false,
        .zone_b_actual_hz = 40000,
        .uptime_ms = 45210,
        .failsafe = false
    };

    cmd.type = CMD_TYPE_PING;
    protocol_format_reply(&cmd, &status, reply, sizeof(reply));
    TEST_ASSERT_EQUAL_STRING("OK PING\n", reply);

    cmd.type = CMD_TYPE_STATUS;
    protocol_format_reply(&cmd, &status, reply, sizeof(reply));
    TEST_ASSERT_EQUAL_STRING("STATUS A=1,40000 B=0,40000 uptime=45210 failsafe=0\n", reply);

    cmd.type = CMD_TYPE_INVALID;
    snprintf(cmd.error_reason, sizeof(cmd.error_reason), "Unknown command");
    protocol_format_reply(&cmd, &status, reply, sizeof(reply));
    TEST_ASSERT_EQUAL_STRING("ERR Unknown command\n", reply);
}

int main(void) {
    UNITY_BEGIN();
    RUN_TEST(test_valid_commands);
    RUN_TEST(test_case_insensitivity_and_whitespace);
    RUN_TEST(test_bad_numbers_and_ranges);
    RUN_TEST(test_too_long_and_empty_lines);
    RUN_TEST(test_formatting_replies);
    return UNITY_END();
}
