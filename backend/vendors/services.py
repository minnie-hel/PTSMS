from vendors.models import Property, Vendor


def default_lodge_property(vendor: Vendor) -> Property:
    """Each vendor is one hotel/lodge; keep a single linked property row for legacy FKs."""
    prop = vendor.properties.order_by("id").first()
    if prop:
        return prop
    return Property.objects.create(vendor=vendor, name=vendor.name, location=vendor.location or "")


def sync_lodge_property(vendor: Vendor) -> None:
    prop = default_lodge_property(vendor)
    if prop.name != vendor.name or (vendor.location and prop.location != vendor.location):
        prop.name = vendor.name
        prop.location = vendor.location or prop.location
        prop.save(update_fields=["name", "location"])
