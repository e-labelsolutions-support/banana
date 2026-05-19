import type { NextPageWithLayout } from "../_app";
import { getDashboardLayout } from "~/components/Dashboard";
import CalendarView from "~/views/calendar";

const CalendarPage: NextPageWithLayout = () => {
  return <CalendarView />;
};

CalendarPage.getLayout = (page) => getDashboardLayout(page);

export default CalendarPage;
