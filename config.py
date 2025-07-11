import os
from configparser import ConfigParser

def load_config(filename='database.ini', section='postgresql'):
    # First try to get DB config from environment variable
    db_url = os.getenv('DATABASE_URL')
    if db_url:
        # If DATABASE_URL is set (e.g. in Docker), parse it into a dict
        # Example DATABASE_URL: postgresql://user:password@host:port/dbname
        from urllib.parse import urlparse

        result = urlparse(db_url)
        return {
            'user': result.username,
            'password': result.password,
            'host': result.hostname,
            'port': result.port or 5432,
            'database': result.path.lstrip('/'),
        }

    # Otherwise fallback to reading database.ini
    parser = ConfigParser()
    parser.read(filename)

    config = {}
    if parser.has_section(section):
        params = parser.items(section)
        for param in params:
            config[param[0]] = param[1]
    else:
        raise Exception(f'Section {section} not found in the {filename} file')

    return config

if __name__ == '__main__':
    config = load_config()
    print(config)
