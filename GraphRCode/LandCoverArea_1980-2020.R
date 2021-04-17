library(dplyr)
library(ggplot2)
library(viridis)



area <- Area_R

# one box per variety
p2 <- ggplot(area, aes(x=Year, y=Area, fill=LandClass, group=Year)) + 
  geom_boxplot() +
  facet_wrap(~LandClass, scale="free")


plot(p2)

hist <- ggplot(area, aes(x = Year, y = Area, fill = LandClass, group=Year,l=30)) +
    geom_bar(stat = "identity", position = "dodge",width=10) + 
  scale_fill_manual(values=c("#645BBF", "#2E7E9E","#A37838", "#DB891F", "#FFCC00"),
                    labels=c('Agriculture','Aquaculture','Mangrove','Other Forest','Urban'))+
    scale_x_continuous(breaks = c(1980,2000,2020)) +
    labs(x = "Decade", y = "Area Size (m2) \n", fill="Land Cover Type") + 
  theme(panel.grid = element_blank(), 
        axis.text = element_text(size = 8), 
        axis.title = element_text(size = 10), 
        plot.title = element_text(size = 8, hjust = 0.5, face = "bold"))+
    facet_wrap(~LandClass, scale="free")
plot(hist)



