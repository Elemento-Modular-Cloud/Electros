project(Electros C CXX)
cmake_minimum_required(VERSION 3.3.2)

set(PLATFORM "mac")
set(ARCHITECTURE "arm64")
set(VERSION "1.4.0b")
set(ENABLE_INSPECTOR ON)

include(cmake/Electros.cmake)

set(SOURCES "src/Browser.h"
            "src/Browser.cpp"
            "src/Tab.h"
            "src/Tab.cpp"
            "src/UI.h"
            "src/UI.cpp"
            "src/main.cpp")

set(CMAKE_OSX_ARCHITECTURES ${ARCHITECTURE} CACHE INTERNAL "" FORCE)

add_app("${SOURCES}")