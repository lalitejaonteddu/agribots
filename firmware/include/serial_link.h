#ifndef SERIAL_LINK_H
#define SERIAL_LINK_H

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

#define RX_RING_BUFFER_SIZE 256
#define MAX_LINE_LEN 64

#ifdef __cplusplus
extern "C" {
#endif

void serial_link_init(uint32_t baudrate);
bool serial_link_get_line(char *out_line, size_t max_len);
void serial_link_write(const char *data, size_t len);
void serial_link_write_str(const char *str);

#ifdef __cplusplus
}
#endif

#endif // SERIAL_LINK_H
