import { SafeAreaView, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import UpdatingBookmarkList from "@/components/bookmarks/UpdatingBookmarkList";
import FullPageSpinner from "@/components/ui/FullPageSpinner";
import PageTitle from "@/components/ui/PageTitle";
import { api } from "@/lib/trpc";

export default function ListView() {
  const { slug } = useLocalSearchParams();
  if (typeof slug !== "string") {
    throw new Error("Unexpected param type");
  }
  const { data: list } = api.lists.get.useQuery({ listId: slug });

  return (
    <SafeAreaView>
      <Stack.Screen
        options={{
          headerTitle: "",
          headerBackTitle: "Back",
          headerTransparent: true,
        }}
      />
      {list ? (
        <View>
          <UpdatingBookmarkList
            query={{
              archived: false,
              listId: list.id,
            }}
            header={<PageTitle title={`${list.icon} ${list.name}`} />}
          />
        </View>
      ) : (
        <FullPageSpinner />
      )}
    </SafeAreaView>
  );
}
