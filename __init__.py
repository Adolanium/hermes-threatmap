"""Hermes Threat Map.

The plugin is a Desktop page. Its Python half only serves the page's backend routes
(dashboard/plugin_api.py); it adds no tools, hooks or commands to the agent.
"""

__version__ = "0.1.0"


def register(ctx) -> None:  # noqa: ARG001 - nothing to register on the agent side
    return None
