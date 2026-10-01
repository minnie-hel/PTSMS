from rest_framework.permissions import SAFE_METHODS, BasePermission

# DRF viewset actions mapped to the permission action they need.
ACTION_FOR_VIEW = {"create": "create", "update": "edit", "partial_update": "edit", "destroy": "delete"}
ACTION_FOR_METHOD = {"POST": "create", "PUT": "edit", "PATCH": "edit", "DELETE": "delete"}


def write_action(request, view):
    """The permission action a write request needs: create, edit or delete."""
    named = getattr(view, "action", None)
    if named in ACTION_FOR_VIEW:
        return ACTION_FOR_VIEW[named]
    if named:  # custom actions such as send, accept, convert change an existing record
        return "edit"
    return ACTION_FOR_METHOD.get(request.method, "edit")


class HasCode(BasePermission):
    """Reads use view.read_permission. Writes use the resource of view.write_permission
    with the action the request needs (create, edit or delete)."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superadmin:
            return True
        if request.method in SAFE_METHODS:
            code = getattr(view, "read_permission", None)
        else:
            base = getattr(view, "write_permission", None)
            code = f"{base.rsplit('.', 1)[0]}.{write_action(request, view)}" if base else None
        if not code:
            return False
        return user.has_code(code)


class HasAnyCode(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superadmin:
            return True
        return any(user.has_code(code) for code in getattr(view, "any_permissions", []))


class CatalogPermission(BasePermission):
    """Settings lists are readable by every signed-in user; changes need settings permissions."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if request.method in SAFE_METHODS or user.is_superadmin:
            return True
        return user.has_code(f"settings.{write_action(request, view)}")


class RolePermission(BasePermission):
    """Roles are read by anyone who manages users (to assign them) and written with roles.* codes."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superadmin:
            return True
        if request.method in SAFE_METHODS:
            return user.has_code("roles.view") or user.has_code("users.view")
        return user.has_code(f"roles.{write_action(request, view)}")
