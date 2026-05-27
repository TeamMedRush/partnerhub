import { type PartnerRouteState, HomeView } from "@components/view/home-view";
import { useForwarded } from "@utils/path";

function resolveRoute(forwarded: string[]): PartnerRouteState {
  const path = `/${forwarded.join("/")}`;

  if (forwarded.length === 0) {
    return { page: "home", path: "/" };
  }

  if (forwarded.length === 1) {
    const segment = forwarded[0];

    if (segment === "login") {
      return { page: "login", path };
    }

    if (segment === "register") {
      return { page: "register", path };
    }

    if (segment === "dashboard") {
      return { page: "dashboard", path };
    }

    if (segment === "inventory") {
      return { page: "inventory", path };
    }

    if (segment === "orders") {
      return { page: "orders", path };
    }

    if (segment === "profile") {
      return { page: "profile", path };
    }
  }

  if (forwarded.length === 2 && forwarded[0] === "inventory") {
    if (forwarded[1] === "new") {
      return { page: "inventory-new", path };
    }

    return {
      page: "inventory-detail",
      path,
      inventoryId: forwarded[1],
    };
  }

  return { page: "not-found", path };
}

export function HomePage() {
  const forwarded = useForwarded();
  return <HomeView route={resolveRoute(forwarded)} />;
}

