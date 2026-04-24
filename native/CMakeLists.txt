cmake_minimum_required(VERSION 3.15)
project(mpv_player)

set(CMAKE_CXX_STANDARD 17)

# Node.js addon setup
include_directories(${CMAKE_JS_INC})
file(GLOB SOURCE_FILES "src/mpv_addon.cpp")
add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES} ${CMAKE_JS_SRC})
set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")
target_link_libraries(${PROJECT_NAME} ${CMAKE_JS_LIB})

# node-addon-api
execute_process(
    COMMAND node -p "require('node-addon-api').include"
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}/..
    OUTPUT_VARIABLE NODE_ADDON_API_DIR
    OUTPUT_STRIP_TRAILING_WHITESPACE
)
string(REPLACE "\"" "" NODE_ADDON_API_DIR ${NODE_ADDON_API_DIR})
target_include_directories(${PROJECT_NAME} PRIVATE ${NODE_ADDON_API_DIR})
target_compile_definitions(${PROJECT_NAME} PRIVATE NAPI_VERSION=8 NAPI_DISABLE_CPP_EXCEPTIONS)

# mpv
if(WIN32)
    set(MPV_DIR "${CMAKE_SOURCE_DIR}/../deps/mpv")
    target_include_directories(${PROJECT_NAME} PRIVATE "${MPV_DIR}/include")
    target_link_libraries(${PROJECT_NAME} "${MPV_DIR}/lib/mpv.lib")
else()
    find_package(PkgConfig REQUIRED)
    pkg_check_modules(MPV REQUIRED mpv)
    target_include_directories(${PROJECT_NAME} PRIVATE ${MPV_INCLUDE_DIRS})
    target_link_libraries(${PROJECT_NAME} ${MPV_LIBRARIES})
endif()
