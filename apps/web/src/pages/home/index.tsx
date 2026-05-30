import type { NextPageWithLayout } from "../_app";
import { getDashboardLayout } from "~/components/Dashboard";
import Popup from "~/components/Popup";
import HomeDashboardView from "~/views/home-dashboard";

const HomePage: NextPageWithLayout = () => {
  return (
    <>
      <HomeDashboardView />
      <Popup />
    </>
  );
};

HomePage.getLayout = (page) => getDashboardLayout(page);

export default HomePage;
