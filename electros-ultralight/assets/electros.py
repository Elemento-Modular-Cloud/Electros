import eel
import requests
import os
import json

# Set web files folder
eel.init('electros')

@eel.expose
def python_function(x):
    return f"Hello from Python! You sent: {x}"

@eel.expose
def check_service_status(url):
    try:
        response = requests.get(url, timeout=5)
        is_accessible = response.status_code == 200
        if is_accessible != check_service_status.last_status.get(url, None):
            print(f"Service status changed for {url}: {'accessible' if is_accessible else 'inaccessible'}")
            check_service_status.last_status[url] = is_accessible
        return is_accessible
    except requests.RequestException:
        if check_service_status.last_status.get(url, None) is not False:
            print(f"Service status changed for {url}: inaccessible")
            check_service_status.last_status[url] = False
        return False

check_service_status.last_status = {}

def read_configurations():
    config_path = os.path.join(os.path.expanduser('~'), '.elemento', 'settings')
    hosts_path = os.path.join(os.path.expanduser('~'), '.elemento', 'hosts')
    
    config = {}
    hosts = []

    # Read settings
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
        except json.JSONDecodeError:
            print(f"Error: Invalid JSON in {config_path}")
        except IOError:
            print(f"Error: Unable to read {config_path}")

    # Read hosts
    if os.path.exists(hosts_path):
        try:
            with open(hosts_path, 'r') as f:
                hosts = f.read().splitlines()
        except IOError:
            print(f"Error: Unable to read {hosts_path}")

    return config, hosts

@eel.expose
def get_configurations():
    config, hosts = read_configurations()
    return {'config': config, 'hosts': hosts}

@eel.expose
def modify_configurations(new_config, new_hosts):

    print('New Config:', new_config)
    print('New Hosts:', new_hosts)

    config_path = os.path.join(os.path.expanduser('~'), '.elemento', 'settings')
    hosts_path = os.path.join(os.path.expanduser('~'), '.elemento', 'hosts')

    # Update and save settings
    try:
        with open(config_path, 'w') as f:
            json.dump(new_config, f, indent=4)
    except IOError:
        print(f"Error: Unable to write to {config_path}")
        return False

    # Update and save hosts
    try:
        with open(hosts_path, 'w') as f:
            f.write('\n'.join(new_hosts))
    except IOError:
        print(f"Error: Unable to write to {hosts_path}")
        return False

    return True

@eel.expose
def update_configurations(config_updates, hosts_updates):
    current_config, current_hosts = read_configurations()
    
    # Update config
    current_config.update(config_updates)
    
    # Update hosts
    current_hosts = list(set(current_hosts + hosts_updates))

    print('Current Config:', current_config)
    print('Current Hosts:', current_hosts)
    
    # Save the updated configurations
    return modify_configurations(current_config, current_hosts)

# Start the app with custom mode and flags
eel.start(
    'electros.html',
    size=(800, 600),
    mode='kiosk',  # or 'chrome-app' if you prefer
    port=8888,  # Use any available port
    cmdline_args=[
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-frame-rate-limit'
    ]
)