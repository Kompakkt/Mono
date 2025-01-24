#! /usr/bin/env bash

function command_exists() {
    command -v "$1" >/dev/null 2>&1
}

function check_dependencies() {
    echo "Checking for needed commands"
    needed_commands=("git" "docker")

    for cmd in "${needed_commands[@]}"; do
        if ! command_exists "$cmd"; then
            echo "Error: $cmd is not installed"
            exit 1
        fi
    done
}

function setup() {
    setup_repos
    setup_base_image
    setup_plugins
}

function setup_repos() {
    echo "Cloning repos"

    repos=(
        "Plugins    debug-plugin-test           https://github.com/Kompakkt/Plugins.git false"
        "Server     test-bun-runtime            https://github.com/Kompakkt/Server.git  false"
        "Repo       debug-plugin-test           https://github.com/Kompakkt/Repo.git    true"
        "Viewer     debug-plugin-test           https://github.com/Kompakkt/Viewer.git  true"
    )

    for repo in "${repos[@]}"; do
        IFS=' ' read -r -a repo <<< "$repo"
        repo_name="${repo[0]}"
        branch="${repo[1]}"
        repo_url="${repo[2]}"
        create_symlink="${repo[3]}"

        if [ -d "$repo_name" ]; then
            echo "Skipping $repo_name"
            continue
        fi

        echo "Cloning $repo_name"
        git clone --recurse-submodules -j8 -b "$branch" "$repo_url" "$repo_name"

        if [ "$create_symlink" = true ]; then
            echo "Creating symlink to plugins for $repo_name"
            cd "$repo_name"
            ln -s ../Plugins/ ./plugins
            cd ..
        fi
    done
}

function setup_base_image() {
    echo "Building base image"
    docker buildx build -t kompakkt/bun-base-image:latest -f bun-base-image.Dockerfile .
}

function setup_plugins() {
    echo "Building plugins"
    env UID=$(id -u) GID=$(id -g) docker compose up plugins
}

function up() {
    serve_command="env UID=$(id -u) GID=$(id -g) docker compose up -d"
    echo "Running: $serve_command"
    if ! eval "$serve_command"; then
        echo "Error: $serve_command failed"
        exit 1
    fi
}

function down() {
    serve_command="docker compose down"
    echo "Running: $serve_command"
    if ! eval "$serve_command"; then
        echo "Error: $serve_command failed"
        exit 1
    fi
}

function show_usage() {
    echo "Usage: $0 [setup] [build]"
    echo "Commands:"
    echo "  setup   Clone and set up repositories"
    echo "  up      Start the server"
    echo "  down    Stop the server"

    exit 1
}

# Check if any arguments were provided
if [ $# -eq 0 ]; then
    show_usage
fi

# Always check dependencies first
check_dependencies

# Process commands
for arg in "$@"; do
    case $arg in
        setup)
            setup
            ;;
        up)
            up
            ;;
        down)
            down
            ;;
        *)
            echo "Unknown command: $arg"
            show_usage
            ;;
    esac
done
