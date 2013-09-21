CC=gcc
CXX=g++
LIBRARIES = util
NATIVE_DIR=$(shell lein run -m typos.native/print-native-resource-dir)

CPPDEFINES = -D_GNU_SOURCE -DDEBUG=$(DEBUG)
CFLAGS += -Wall -Wextra -std=gnu99 -O2 -ggdb3 -pipe -pthread -lutil -fPIC
CXXFLAGS +=-Wall -Wextra -O2 -ggdb3 -pipe -pthread -lutil -fPIC
LDFLAGS =
LDLIBS = $(patsubst %,-l%,$(patsubst lib%,%,$(IMPORTS)) $(LIBRARIES))

SRCS = $(wildcard src/c/*.c)
COBJS = $(SRCS:.c=.o)
OBJS = $(COBJS:.cpp=.o)
CDEPS = $(SRCS:.c=.d)
DEPS = $(CDEPS:.cpp=.d)
LIBSO = $(NATIVE_DIR)/libtypos.so
TARGETS = $(LIBSO)

all: $(TARGETS)

$(LIBSO): $(OBJS)
	mkdir -p $(NATIVE_DIR)
	$(CXX) $(LDFLAGS) -shared -o $@ $^ $(LDLIBS)

src/c/%.o: src/c/%.c
	$(CC) $(CFLAGS) $(CPPFLAGS) -o $@ -c $^

.PHONY : clean
clean:
	rm -f $(DEPS) $(OBJS) $(TARGETS) $(TEST).o $(PRODTEST).o
