"""Permission catalog.

Every screen ("resource") belongs to a module and offers up to five actions:
view, create, edit, delete and manage. "manage" grants every action on the
resource. Any action other than view also implies view, so a role never ends up
able to edit a record it cannot see.
"""

ACTIONS = ["view", "create", "edit", "delete", "manage"]
ACTION_LABELS = {
    "view": "View",
    "create": "Create",
    "edit": "Edit",
    "delete": "Delete",
    "manage": "Manage",
}
VIEW_ONLY = ["view"]

# (module, [(resource, label, actions)])
MODULES = [
    ("Dashboard", [
        ("dashboard", "Overview", VIEW_ONLY),
        ("reports", "Module and system reports", VIEW_ONLY),
    ]),
    ("CRM", [
        ("leads", "Leads", ACTIONS),
        ("clients", "Clients", ACTIONS),
    ]),
    ("Sales", [
        ("quotations", "Quotations", ACTIONS),
        ("itineraries", "Itineraries", ACTIONS),
    ]),
    ("Bookings", [
        ("bookings", "Bookings", ACTIONS),
    ]),
    ("Operations", [
        ("operations", "Safari operations", VIEW_ONLY),
        ("vendors", "Accommodation vendors", ACTIONS),
    ]),
    ("Finance", [
        ("invoices", "Invoices", ACTIONS),
        ("payments", "Client payments", ACTIONS),
        ("expenses", "Expenses", ACTIONS),
        ("costs", "Hotel costs and vendor payments", ACTIONS),
        ("cashbook", "Cashbook", VIEW_ONLY),
        ("profitability", "Profitability", VIEW_ONLY),
    ]),
    ("Users", [
        ("users", "Users", ACTIONS),
        ("roles", "Roles and permissions", ACTIONS),
    ]),
    ("Company", [
        ("settings", "Settings and lists", ACTIONS),
    ]),
]

RESOURCE_INFO = {
    resource: {"module": module, "label": label, "actions": actions}
    for module, resources in MODULES
    for resource, label, actions in resources
}

PERMISSIONS = [
    (f"{resource}.{action}", f"{ACTION_LABELS[action]} {label.lower()}", module)
    for module, resources in MODULES
    for resource, label, actions in resources
    for action in actions
]


def catalog_tree():
    """Module -> resources -> actions, for the role editor."""
    return [
        {
            "module": module,
            "resources": [
                {"resource": resource, "label": label, "actions": actions}
                for resource, label, actions in resources
            ],
        }
        for module, resources in MODULES
    ]


def describe(code):
    resource, _, action = code.partition(".")
    info = RESOURCE_INFO.get(resource, {})
    return {
        "resource": resource,
        "action": action,
        "resource_label": info.get("label", resource.title()),
    }


def expand_codes(codes):
    """Turn the codes stored on a role into every code the role effectively holds."""
    expanded = set()
    for code in codes:
        resource, _, action = code.partition(".")
        expanded.add(code)
        info = RESOURCE_INFO.get(resource)
        if action == "manage":
            allowed = info["actions"] if info else ACTIONS
            expanded.update(f"{resource}.{item}" for item in allowed)
        if action and action != "view":
            expanded.add(f"{resource}.view")
    return expanded
