import { getNovelViews, getNovelTotalChapters } from '@/lib/novelStats';
import { generateChaptersForNovel } from '@/lib/storyGenerator';

export interface FallbackChapter {
  id: string;
  chapterNumber: number;
  title: string;
  content: string;
  createdAt: string;
  isVip?: boolean;
  coinPrice?: number;
}

export interface FallbackNovel {
  id: string;
  title: string;
  author: string;
  description: string;
  genres: string[];
  coverUrl: string;
  rating: number;
  views: number;
  status: 'Đang ra' | 'Hoàn thành';
  isHot: boolean;
  isFull: boolean;
  totalChapters: number;
  chapters: FallbackChapter[];
  updatedAt: string;
  isPublic: boolean;
  approvalStatus: string;
}

const BASE_FALLBACK_NOVELS: FallbackNovel[] = [
  {
    id: 'vo-than-chua-te',
    title: 'Võ Thần Chúa Tể',
    author: 'Ám Ma Sư',
    description: 'Thiên Vũ đại lục đệ nhất Đan Hoàng Tần Trần, vì bị hồng nhan tri kỷ và huynh đệ kết nghĩa phản bội mà ôm hận ngã xuống. Ba trăm năm sau, hắn chuyển sinh trọng sinh vào một thiếu niên phế vật cùng tên tại vương triều Đại Tề. Nắm giữ đan đạo chí tôn kiếp trước cùng ký ức võ đạo thông thiên, Tần Trần quyết tâm quét sạch mọi cản trở, chấn hưng gia tộc, từng bước đạp phá thiên địa, tái lâm đỉnh phong báo huyết hải thâm thù!',
    genres: ['Huyền Huyễn', 'Tiên Hiệp', 'Trọng Sinh', 'Hệ Thống'],
    coverUrl: '/covers/vo-than-chua-te.jpg',
    rating: 4.9,
    views: 186500,
    status: 'Đang ra',
    isHot: true,
    isFull: false,
    totalChapters: 450,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Trọng sinh ba trăm năm',
        content: `Thiên Vũ đại lục, ba trăm năm trước.

Trên đỉnh Tử Thần Nhai, mây mù cuồn cuộn vần vũ. Một thân ảnh cao ngạo đứng sừng sững giữa trời đất, trường bào nhuộm đỏ máu tươi.

"Thượng Quan Hi Nhi, Phong Thiếu Vũ! Ta đối đãi với các ngươi hết lòng hết dạ, coi như chí thân ruột thịt, dốc hết tâm huyết luyện chế Cửu Chuyển Thần Đan cho các ngươi... Không ngờ tới phút cuối cùng, hai kẻ các ngươi lại liên thủ đâm một nhát kiếm xuyên tim ta!"

Tần Trần cười thảm, tiếng cười chấn động cửu tiêu, bi phẫn tột cùng. Hắn là đệ nhất Đan Hoàng của đại lục, nghiên cứu ra vô số tuyệt kỹ đan đạo và trận pháp vang danh thiên cổ, nhưng rốt cuộc lại chết dưới tay người mình yêu thương nhất và huynh đệ kết nghĩa thề sống chết.

"Tần Trần, trách thì trách ngươi quá mức chói sáng, nắm giữ bí mật thần cấm mà không chịu giao ra!" Giọng nói lãnh khốc vô tình của nữ tử áo đỏ vẫn còn văng vẳng bên tai.

Oành!

Tần Trần dứt khoát dẫn nổ đan điền, thân thể hóa thành tro bụi giữa vòm trời bão táp.

...

"Đau quá..."

Trong một gian phòng gỗ thô sơ ngập tràn mùi thảo dược, một thiếu niên đột nhiên mở bừng mắt. Hắn thở hổn hển, mồ hôi ướt đẫm trán, bàn tay nắm chặt lấy mép giường.

"Đây là đâu? Ta... chưa chết sao?"

Ký ức xa lạ như thủy triều cuồn cuộn tràn vào óc. Hắn hiện tại đang ở vương quốc Đại Tề, thuộc một góc hẻo lánh của Thiên Vũ đại lục. Thân thể này cũng mang tên Tần Trần, là con trai của Tần Nguyệt Trì – thiên kim Tần gia nhưng vì sinh con không rõ phụ thân mà bị gia tộc ruồng bỏ, giáng xuống gia phả, chịu muôn vàn nhục nhã.

Bản thân thiếu niên này trời sinh kinh mạch bế tắc, mười sáu tuổi vẫn chưa thể ngưng tụ chân khí, bị coi là phế vật nổi tiếng toàn Vương đô.

"Ba trăm năm rồi... Không ngờ đã ba trăm năm trôi qua!"

Tần Trần bước xuống giường, nhìn vào chiếc gương đồng mờ đục. Gương mặt thiếu niên thanh tú nhưng tái nhợt, ánh mắt lại lộ ra vẻ thâm thúy và uy nghiêm của bậc đế hoàng từng ngự trị đỉnh cao thiên hạ.

"Thượng Quan Hi Nhi, Phong Thiếu Vũ... Các ngươi thành lập Chấp Pháp Điện, xưng bá Thiên Vũ, được vạn người tôn sùng là Thánh Chủ sao? Hãy đợi đấy! Tần Trần ta đã trở lại, nợ máu kiếp trước, kiếp này ta bắt các ngươi phải hoàn trả gấp trăm ngàn lần!"`,
        createdAt: '2026-10-20T08:00:00Z',
      },
      {
        id: 'chuong-2',
        chapterNumber: 2,
        title: 'Chương 2: Tuyệt thế dược lý',
        content: `Tần Trần đứng trước gương, quan sát kỹ lưỡng kinh mạch của cơ thể mới này rồi lắc đầu cười khẽ:

"Kinh mạch tắc nghẽn, khí huyết hao hụt, quả thực ngay cả võ giả sơ cấp cũng không bằng. Nhưng đối với Đan Hoàng Tần Trần ta, đây căn bản chỉ là chuyện nhỏ."

Kiếp trước hắn tinh thông y đạo lẫn võ đạo, nắm giữ vô số đan phương thất truyền từ thời viễn cổ. Chỉ cần có đủ dược liệu, việc đả thông kinh mạch và rèn đúc lại căn cơ hoàn toàn nằm trong lòng bàn tay.

"Trần nhi, con tỉnh rồi sao? Tạ ơn trời đất!"

Cửa phòng bật mở, một mỹ phụ trung niên mang vẻ mặt tiều tụy nhưng đường nét vô cùng đoan trang bước vội vào. Thấy Tần Trần đứng dậy, khóe mắt bà đỏ hoe, ôm chầm lấy hắn. Đây chính là mẫu thân của hắn kiếp này – Tần Nguyệt Trì.

"Mẹ, con đã không sao rồi. Từ nay về sau, có con ở đây, tuyệt đối không ai có thể khi bắt nạt mẫu tử chúng ta được nữa!" Tần Trần nhẹ nhàng vỗ về vai bà, ánh mắt tràn đầy kiên định.

Hắn quyết định đến Tụ Bảo Các – linh dược phường lớn nhất vương đô để tìm kiếm vài vị dược liệu cần thiết cho việc luyện chế Tẩy Tủy Dịch.

Bước vào đại sảnh Tụ Bảo Các ngào ngạt hương thảo dược, Tần Trần đưa mắt nhìn quanh. Đúng lúc một gã đan đồ đang lúng túng giải thích cho khách hàng về một gốc Xích Diễm Thảo, Tần Trần cất giọng điềm tĩnh:

"Xích Diễm Thảo sinh trưởng nơi nham thạch, nếu đem phối hợp cùng Băng Tâm Hoa mà không dùng Uẩn Linh Thủy trung hòa thì chẳng những triệt tiêu dược tính, mà còn biến thành kịch độc phế bỏ đan điền võ giả!"

Lời vừa dứt, toàn bộ đại sảnh đột nhiên im bặt!`,
        createdAt: '2026-10-21T09:00:00Z',
      },
      {
        id: 'chuong-3',
        chapterNumber: 3,
        title: 'Chương 3: Chấn kinh Tụ Bảo Các',
        content: `Tất cả ánh mắt trong sảnh lập tức đổ dồn về phía thiếu niên áo vải vừa lên tiếng.

"Khốn kiếp! Ngươi là ai mà dám ăn nói hàm hồ ở Tụ Bảo Các của ta?" Gã đan đồ thẹn quá hóa giận quát lớn.

"Hỗn xược, lui ra!"

Từ trên tầng hai, một giọng nói trầm hùng uy nghiêm vang lên. Một lão giả mặc trường bào luyện dược sư tam phẩm vội vã bước xuống, trên mặt tràn đầy kinh ngạc và kích động. Đây chính là Triệu Linh Chi – các chủ Tụ Bảo Các, một trong những đan sư có danh vọng cao nhất Đại Tề quốc.

Vấn đề phối hợp Xích Diễm Thảo và Băng Tâm Hoa đã khiến lão trăn trở suốt ba năm qua mà chưa tìm ra lời giải. Vừa rồi nghe thiếu niên nói đến ba chữ 'Uẩn Linh Thủy', trong đầu lão như có một tia sét đánh qua khai thông mọi bế tắc!

"Dám hỏi tiểu hữu, phương pháp dùng Uẩn Linh Thủy trung hòa này, ngươi học được từ vị cao nhân nào?" Lão giả cung kính cúi người hỏi, khiến toàn thể hộ vệ và khách mua hàng tròn xoe mắt kinh hãi.

Tần Trần mỉm cười nhạt: "Không cần hỏi xuất xứ. Ta đến đây là muốn đổi lấy ba gốc Tử Vân Thảo và một viên Thú Đan nhị giai. Lão các chủ thấy dược lý vừa rồi có đủ giá trị hay không?"

"Đủ! Quá đủ! Người đâu, mau mang dược liệu thượng phẩm nhất lên cho tiểu tiên sinh!" Triệu Linh Chi không chút do dự hạ lệnh.`,
        createdAt: '2026-10-22T10:00:00Z',
      },
    ],
  },
  {
    id: 'nu-phu-phan-cong-he-thong-nu-than-gioi-giai-tri-4w51',
    title: 'Nữ Phụ Phản Công: Hệ Thống Nữ Thần Giới Giải Trí',
    author: 'Lam Tuyết',
    description: 'Bị bạn trai "cắm sừng" và đồng nghiệp hãm hại, cô gái yếu đuối năm xưa nay đã có "Hệ Thống Đổi Đời" trong tay! Trọng sinh không phải là kết thúc, mà là khởi đầu cho hành trình báo thù và vươn tới đỉnh cao giới giải trí. Từng bước giẫm đạp tra nam tiện nữ, đoạt lấy ảnh hậu kim quang tỏa sáng!',
    genres: ['Hệ Thống', 'Đô Thị', 'Nữ Cường', 'Trọng Sinh'],
    coverUrl: '/covers/nu-phu-phan-cong.jpg',
    rating: 4.9,
    views: 142000,
    status: 'Đang ra',
    isHot: true,
    isFull: false,
    totalChapters: 380,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Trọng sinh ngày bị phản bội',
        content: `Ánh đèn flash chói lóa cùng tiếng xì xào bàn tán của đám phóng viên như những chiếc kim nhọn đâm thẳng vào màng nhĩ Tô Mạt.

"Tô Mạt, cô giải thích sao về việc bị bắt gặp say xỉn trong phòng của đạo diễn Vương?"
"Có phải cô cố tình dùng quy tắc ngầm để cướp vai diễn của em họ mình không?"

Tô Mạt mở bừng mắt. Khung cảnh trước mắt quá đỗi quen thuộc... Đây chính là buổi họp báo ác mộng ba năm trước! Ngày mà cô bị bạn trai Lục Cảnh Thành và cô em họ Tô Nhã gài bẫy, tước đoạt toàn bộ danh dự, bị đuổi khỏi giới giải trí rồi rơi vào trầm cảm mà tự sát.

[Đinh! Phát hiện oán khí mãnh liệt của ký chủ. Hệ Thống Nữ Thần Giới Giải Trí chính thức kích hoạt!]
[Phần thưởng tân thủ: Nhan sắc tăng cấp SSS + Kỹ năng diễn xuất Thần Cấp!]

Khóe môi Tô Mạt khẽ nhếch lên một nụ cười lạnh lùng quyến rũ. Kiếp này, ai là thợ săn, ai là con mồi, hãy chờ xem!`,
        createdAt: '2026-10-20T08:00:00Z',
      },
      {
        id: 'chuong-2',
        chapterNumber: 2,
        title: 'Chương 2: Cú tát nghẹn ngào',
        content: `Đối diện với hàng chục ống kính máy quay đang chĩa vào mình, Tô Mạt không hề hoảng loạn rơi nước mắt như kiếp trước.

Cô bình thản cầm lấy micro, ngẩng cao đầu. Khí chất cao quý, ánh mắt sắc sảo như lưỡi kiếm khiến cả hội trường trong chớp mắt bỗng chốc im bặt.

"Các vị phóng viên, muốn biết sự thật? Tại sao không xem đoạn ghi âm khách sạn tối qua do chính trợ lý của Lục Cảnh Thành gửi cho tôi?"

Tô Mạt giơ chiếc điện thoại lên, mở loa ngoài. Tiếng bàn mưu tính kế hèn hạ giữa Lục Cảnh Thành và Tô Nhã vang vọng khắp sảnh lớn. Sắc mặt hai kẻ đang ngồi ở hàng ghế VIP lập tức trắng bệch như xác chết!`,
        createdAt: '2026-10-21T08:00:00Z',
      },
    ],
  },
  {
    id: 'tong-tai-co-chap-vo-cu-lai-yeu-lan-nua-65wu',
    title: 'Tổng Tài Cố Chấp: Vợ Cũ, Lại Yêu Lần Nữa',
    author: 'Cố Niệm',
    description: 'Ba năm hôn nhân đổi lại một tờ giấy ly hôn lạnh lùng cùng sự ruồng bỏ. Ngày cô dứt áo ra đi, người đàn ông quyền lực nhất thành phố coi đó chỉ là trò giận dỗi trẻ con. Thế nhưng khi cô trở lại với thân phận nhà thiết kế danh giá hàng đầu thế giới, vị tổng tài kiêu ngạo ấy lại phát điên quỳ gối dưới mưa cầu xin cô quay về.',
    genres: ['Ngôn Tình', 'Đô Thị', 'Hào Môn', 'Ngược Sủng'],
    coverUrl: '/covers/tong-tai-co-chap.jpg',
    rating: 4.8,
    views: 93400,
    status: 'Hoàn thành',
    isHot: true,
    isFull: true,
    totalChapters: 210,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Đơn ly hôn',
        content: `Đêm mưa tầm tã bên ngoài biệt thự họ Phó.

Thẩm An Nhiên đặt tờ đơn ly hôn đã ký sẵn lên bàn trà bằng đá cẩm thạch. Trên ngón áp út của cô, chiếc nhẫn cưới bạc đơn sơ đã được tháo xuống.

Phó Kính Thần cởi áo khoác vest, ánh mắt lạnh lùng liếc nhìn tờ giấy: "Lại giở trò gì nữa đây? Thẩm An Nhiên, lòng kiên nhẫn của tôi có hạn."

"Tôi không đùa, Phó thiếu gia. Chúng ta kết thúc tại đây." An Nhiên mỉm cười, một nụ cười thanh thản mà ba năm qua Phó Kính Thần chưa từng nhìn thấy ở cô.`,
        createdAt: '2026-10-20T08:00:00Z',
      },
      {
        id: 'chuong-2',
        chapterNumber: 2,
        title: 'Chương 2: Tái ngộ đỉnh cao',
        content: `Năm năm sau.

Sân bay quốc tế thành phố S, một bóng hồng thanh mảnh trong bộ vest trắng bước ra, theo sau là trợ lý và hàng dài vệ sĩ áo đen.

Nhà thiết kế hàng đầu Paris kiêm nữ chủ tịch tập đoàn thời trang Celia – Thẩm An Nhiên chính thức trở về. Mà người đứng chờ ở cửa VIP với ánh mắt đỏ ngầu, run rẩy không dám bước tới, lại chính là vị tổng tài ngạo mạn năm xưa – Phó Kính Thần.`,
        createdAt: '2026-10-21T08:00:00Z',
      },
    ],
  },
  {
    id: 'thi-the-cua-ta-buong-tha-phong-tung-khong-kiem-che-duoc',
    title: 'Thi Thể Của Ta Buông Thả Phóng Túng Không Kiềm Chế Được',
    author: 'Cửu U Đạo Nhân',
    description: 'Chết đi không phải là hết! Linh hồn của ta bị giam giữ trôi dạt giữa hư không, trơ mắt nhìn thi thể của chính mình dưới trăng máu đột nhiên đứng dậy... tu luyện ma công, đại náo âm dương!',
    genres: ['Kinh Dị', 'Huyền Huyễn', 'Hài Hước', 'Trọng Sinh'],
    coverUrl: '/covers/cover-thi-the.jpg',
    rating: 4.9,
    views: 128000,
    status: 'Đang ra',
    isHot: true,
    isFull: false,
    totalChapters: 310,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Dưới trăng máu, thi thể thức tỉnh',
        content: `Trăng máu treo lơ lửng trên bãi tha ma hoang vu. Gió rít từng cơn lạnh thấu xương tủy.

Linh hồn ta lơ lửng giữa không trung, bất lực nhìn xuống cái xác đang nằm thẳng đơ trong cỗ quan tài gỗ mục.

"Ủa khoan... Sao ngón tay của cái xác ta lại vừa giật một cái?"

Chưa kịp hiểu chuyện gì, nắp quan tài nổ tung thành trăm mảnh. Thi thể của ta mở trừng hai mắt đỏ rực như chu sa, bật dậy bẻ khớp kêu răng rắc!`,
        createdAt: '2026-10-20T08:00:00Z',
      },
    ],
  },
  {
    id: 'yeu-than-giang-the',
    title: 'Yêu Thần Giáng Thế',
    author: 'Bát Hoang Cư Sĩ',
    description: 'Yêu Thần thức tỉnh xé toạc thương khung, chưởng khống thái cổ hồng hoang dị thú, đạp phá chư thiên thần phật, đúc nên vạn cổ bất hủ chân thân.',
    genres: ['Huyền Huyễn', 'Tiên Hiệp', 'Dị Giới'],
    coverUrl: '/covers/cover-yeu-than.jpg',
    rating: 4.9,
    views: 165000,
    status: 'Đang ra',
    isHot: true,
    isFull: false,
    totalChapters: 520,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Thái cổ Yêu Huyết thức tỉnh',
        content: `Mười vạn năm trước, Yêu Thần tung hoành vạn giới, Thần Ma cúi đầu.

Hôm nay, trong huyết mạch của một thiếu niên nô bộc tầm thường ở Man Hoang đại lục, giọt Yêu Huyết phong ấn từ viễn cổ đột nhiên bốc cháy hừng hực! Khí tức hồng hoang quét ngang ngàn dặm, thiên địa biến sắc.`,
        createdAt: '2026-10-20T08:00:00Z',
      },
    ],
  },
  {
    id: 'muc-than-ky',
    title: 'Mục Thần Ký',
    author: 'Trạch Trư',
    description: 'Đại Khư tàn lão thôn xuất thế, mục dưỡng thần ma thiên hạ. Cậu bé mù, người thọt, bà mù nuôi lớn một thiếu niên không sợ trời không sợ đất, bước ra mở ra thời đại huy hoàng.',
    genres: ['Tiên Hiệp', 'Huyền Huyễn', 'Kỳ Huyễn'],
    coverUrl: '/covers/cover-muc-than.jpg',
    rating: 5.0,
    views: 198000,
    status: 'Hoàn thành',
    isHot: true,
    isFull: true,
    totalChapters: 1820,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Bên bờ sông Dũng Giang',
        content: `Trời tối rồi, đừng ra ngoài.

Lời dặn dò ngàn đời của tộc nhân Đại Khư vang vọng khắp sơn dã. Bên bờ sông Dũng Giang cuồn cuộn chảy xiết, một đứa bé sơ sinh nằm gọn trong chiếc chậu gỗ trôi dạt vào bờ cát dưới sự che chở của một con hồ ly trắng...`,
        createdAt: '2026-10-20T08:00:00Z',
      },
    ],
  },
  {
    id: 'nhat-niem-vinh-hang',
    title: 'Nhất Niệm Vĩnh Hằng',
    author: 'Nhĩ Căn',
    description: 'Một niệm thành biển cả, một niệm hóa nương dâu. Nhất niệm trảm ngàn ma, nhất niệm tru vạn tiên. Duy ta niệm... Vĩnh hằng!',
    genres: ['Tiên Hiệp', 'Hài Hước', 'Tu Chân'],
    coverUrl: '/covers/cover-vinh-hang.jpg',
    rating: 4.9,
    views: 174000,
    status: 'Hoàn thành',
    isHot: true,
    isFull: true,
    totalChapters: 1314,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Bạch Tiểu Thuần sợ chết',
        content: `Mao Sơn hạ, thôn trang nhỏ.

Bạch Tiểu Thuần gầy gò mặc áo vải thô, run rẩy châm nén nhang thứ mười ba trên đỉnh núi. Sấm sét rền vang chân trời, hắn ôm đầu la lớn:

"Tiên nhân gia gia, người mau tới đi! Con sợ sét đánh chết mất thôi!"`,
        createdAt: '2026-10-20T08:00:00Z',
      },
    ],
  },
  {
    id: 'nghich-menh-thanh-ma',
    title: 'Nghịch Mệnh Thánh Ma',
    author: 'Bất Bại Chiến Thần',
    description: 'Thiên đạo bất công, coi vạn vật như cỏ rác. Vậy thì ta nhập ma đạo, nghịch thiên cải mệnh, đồ sát thánh nhân!',
    genres: ['Tiên Hiệp', 'Mạt Thế', 'Hắc Ám'],
    coverUrl: '/covers/cover-nghich-menh.jpg',
    rating: 4.8,
    views: 115000,
    status: 'Đang ra',
    isHot: false,
    isFull: false,
    totalChapters: 290,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Huyết tẩy tông môn',
        content: `Huyết quang ngập trời nhuộm đỏ chín tầng mây.

Cầm thanh kiếm gãy trong tay, Tiêu Viêm nhìn những kẻ tự xưng là danh môn chính phái đang vây quanh mình, khóe miệng nhếch lên nụ cười tàn nhẫn: "Các ngươi muốn ta chết? Ta sẽ kéo cả tông môn các ngươi cùng chôn thây!"`,
        createdAt: '2026-10-20T08:00:00Z',
      },
    ],
  },
  {
    id: 'tu-xuan',
    title: 'Tự Xuân',
    author: 'Yến Quy Lai',
    description: 'Cung đình thâm sâu như biển máu, từng bước kinh tâm đoạt lấy phượng vị. Nữ nhi danh môn tái xuất, xoay chuyển càn khôn triều đình.',
    genres: ['Cung Đấu', 'Cổ Đại', 'Trùng Sinh', 'Ngôn Tình'],
    coverUrl: '/covers/cover-tu-xuan.jpg',
    rating: 4.9,
    views: 89000,
    status: 'Hoàn thành',
    isHot: false,
    isFull: true,
    totalChapters: 180,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Mưa thu trong cung cấm',
        content: `Mưa thu rơi lộp độp trên mái ngói lưu ly của Dực Khôn Cung.

Khương Nhược Huyên ngồi trước bàn trang điểm, nâng chén trà hoa cúc thơm ngát. Nàng biết, ngày mai thánh chỉ sắc phong hoàng hậu sẽ được ban xuống, nhưng vị trí đó là do nàng dẫm lên hàng ngàn cạm bẫy mà đoạt lấy.`,
        createdAt: '2026-10-20T08:00:00Z',
      },
    ],
  },
  {
    id: 'trong-sinh-ta-khong-lam-oan-gia',
    title: 'Trọng Sinh Ta Không Làm Oan Gia',
    author: 'Nguyệt Hạ Khán Thư',
    description: 'Kiếp trước gả nhầm người, cả nhà chịu tru di tam tộc. Kiếp này quay về tuổi mười lăm, nàng quyết từ hôn, bảo vệ gia môn, tìm lại chân ái đời mình.',
    genres: ['Trọng Sinh', 'Cổ Đại', 'Gia Đấu', 'Ngôn Tình'],
    coverUrl: '/covers/cover-trong-sinh-oan-gia.jpg',
    rating: 4.8,
    views: 96000,
    status: 'Hoàn thành',
    isHot: false,
    isFull: true,
    totalChapters: 220,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Tỉnh lại giữa hoa lê',
        content: `Hương hoa lê thoang thoảng trong gió sớm mùa xuân.

Mộc Thanh Dao sờ lên cần cổ mịn màng không chút tỳ vết của mình, nước mắt tuôn rơi. Nàng đã thực sự quay về năm mười lăm tuổi, trước khi bản thân bước lên kiệu hoa gả cho gã lang quân trăng hoa táng tận lương tâm kia.`,
        createdAt: '2026-10-20T08:00:00Z',
      },
    ],
  },
  {
    id: 'dai-ca-nhat-quyet-cuoi-ky-nu-ta-thanh-toan-cho-han-ca-doi-phai-hoi-han',
    title: 'Đại Ca Nhất Quyết Cưới Kỹ Nữ, Ta Thành Toàn Cho Hắn Cả Đời Phải Hối Hận',
    author: 'Tô Tiếu Tiếu',
    description: 'Đại ca vì một ả phong trần mà đòi đuổi mẹ ruột và muội muội ra khỏi phủ. Ta không khóc lóc, chỉ lặng lẽ mang toàn bộ hồi môn và gia sản rời đi. Để xem không có bạc của ta, đôi uyên ương các ngươi sống được mấy ngày!',
    genres: ['Gia Đấu', 'Cổ Đại', 'Nữ Cường', 'Sảng Văn'],
    coverUrl: '/covers/cover-dai-ca-cuoi-ky-nu.jpg',
    rating: 4.9,
    views: 112000,
    status: 'Hoàn thành',
    isHot: true,
    isFull: true,
    totalChapters: 85,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Đoạn tuyệt gia môn',
        content: `Trước sảnh đường Tạ phủ, đại ca Tạ Hoài An quỳ gối, dập đầu đến chảy máu:

"Mẫu thân, muội muội! Con và Liễu cô nương là chân ái! Nếu gia đình không cho con cưới nàng làm chính thê, con thà từ bỏ công danh!"

Ả kỹ nữ Liễu Như Yên nép sau lưng hắn, khóe môi thoáng hiện nụ cười đắc thắng.

Ta nhẹ nhàng đặt chén trà xuống, ra hiệu cho chưởng quầy mang khế ước gia sản ra: "Được, vậy hôm nay chia gia tài. Toàn bộ điền trang, ngân hiệu đứng tên ta và mẫu thân, một xu huynh cũng đừng hòng đụng tới."`,
        createdAt: '2026-10-20T08:00:00Z',
      },
    ],
  },
  {
    id: 'luan-hoi-chi-chu-tuoc-doat-van-gioi',
    title: 'Luân Hồi Chi Chủ: Tước Đoạt Vạn Giới',
    author: 'Cửu Trọng Thiên',
    description: 'Mở ra Luân Hồi Chi Nhãn, tước đoạt khí vận chư thiên vạn giới. Bắt đầu từ một tiểu tốt vô danh, cướp đoạt công pháp, bảo vật, xưng bá thần giới.',
    genres: ['Huyền Huyễn', 'Võng Du', 'Hệ Thống'],
    coverUrl: '/covers/cover-luan-hoi.jpg',
    rating: 4.8,
    views: 104000,
    status: 'Đang ra',
    isHot: false,
    isFull: false,
    totalChapters: 360,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Thần đồng Luân Hồi',
        content: `[Đinh! Kích hoạt Luân Hồi Chi Nhãn thành công!]
[Phát hiện khí vận tử kim của Thiên Mệnh Chi Tử trong phạm vi 10 mét... Bắt đầu tước đoạt!]

Lâm Phong mở mắt ra, nhìn thấy vầng hào quang chói mắt trên đỉnh đầu kẻ thù truyền kiếp đang từ từ chuyển dời sang cơ thể mình. Một kỷ nguyên mới đã bắt đầu!`,
        createdAt: '2026-10-20T08:00:00Z',
      },
    ],
  },
  {
    id: 'vao-ngay-thu-100-ly-hon-toi-chet-tren-ban-mo-cua-nguoi-chong-yeu-dau',
    title: 'Vào Ngày Thứ 100 Ly Hôn, Tôi Chết Trên Bàn Mổ Của Người Chồng Yêu Dấu',
    author: 'Bạch Lộ',
    description: 'Anh là bác sĩ ngoại khoa xuất sắc nhất, nhưng lưỡi dao của anh lại không thể cứu được trái tim đã nguội lạnh của cô. Ngày cô trút hơi thở cuối cùng, anh mới điên cuồng nhận ra ai mới là mạng sống của đời mình.',
    genres: ['Ngôn Tình', 'Ngược Tâm', 'Đô Thị', 'Chữa Lành'],
    coverUrl: '/covers/cover-100-ngay-ly-hon.jpg',
    rating: 4.9,
    views: 125000,
    status: 'Hoàn thành',
    isHot: true,
    isFull: true,
    totalChapters: 120,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Nhịp tim ngừng đập',
        content: `Tít... Tít... Títttttt——

Đường điện tâm đồ trên màn hình máy đo phẳng lì thành một đường thẳng tắp.

Đôi bàn tay cầm dao mổ của viện trưởng Kỷ Trạch Hạo đột nhiên run rẩy dữ dội. Máu tươi nhuộm đỏ găng tay cao su. Người phụ nữ nằm dưới ánh đèn phẫu thuật sắc lạnh chính là người vợ mà anh đã ký đơn ly hôn đúng một trăm ngày trước.`,
        createdAt: '2026-10-20T08:00:00Z',
      },
    ],
  },
  {
    id: 'dem-trang-muong-ba-li',
    title: 'Đêm Trắng Mường Ba Lí',
    author: 'Trần Vũ Hoàng',
    description: 'Một vụ án bí ẩn giữa núi rừng Tây Bắc hiểm trở. Đằng sau những tập tục cổ xưa là âm mưu kinh hoàng và câu chuyện tình yêu đầy bi tráng.',
    genres: ['Kinh Dị', 'Trinh Thám', 'Đô Thị'],
    coverUrl: '/covers/dem-trang-muong-ba-li.jpg',
    rating: 4.8,
    views: 87000,
    status: 'Hoàn thành',
    isHot: false,
    isFull: true,
    totalChapters: 65,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Tiếng sáo trong đêm sương mù',
        content: `Đêm Mường Ba Lí lạnh căm căm.

Sương mù giăng kín đỉnh đèo như dải lụa trắng ma mị. Từ sâu trong thung lũng hoang phế, vẳng lại tiếng khèn bè thê lương ai oán khiến đàn chim đêm bay tán loạn...`,
        createdAt: '2026-10-20T08:00:00Z',
      },
    ],
  },
  {
    id: 'quy-bi-chi-chu',
    title: 'Quỷ Bí Chi Chủ',
    author: 'Mực Thích Lặn Nước',
    description: 'Trong làn sóng hơi nước cùng máy móc cuồn cuộn, ai có thể chạm tới phi phàm? Màn sương lịch sử giăng lối, tiếng thì thầm của tà thần văng vẳng bên tai. Chu Minh Thụy xuyên không thức tỉnh giữa thế giới huyền bí thời kỳ Victoria, bắt đầu hành trình từ gã bói toán thấp bé trở thành Ngu Giả vĩ đại.',
    genres: ['Kinh Dị', 'Huyền Huyễn', 'Phương Tây'],
    coverUrl: '/covers/genre-kinhdi.jpg',
    rating: 5.0,
    views: 3125000,
    status: 'Hoàn thành',
    isHot: true,
    isFull: true,
    totalChapters: 1432,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Hồng Nguyệt Khởi Đầu',
        content: `Đầu đau như muốn nứt ra.
Cơn đau nhức nhối như thủy triều dâng lên khiến Chu Minh Thụy từ trong cơn mê man từ từ tỉnh lại.
Trước mắt hắn là một căn phòng cổ điển kiểu Tây âu, trên bàn là khẩu súng lục ổ quay và vết máu đỏ thẫm loang lổ trên bức tường phía sau...`,
        createdAt: '2026-10-21T08:00:00Z',
      }
    ],
  },
  {
    id: 'toan-cau-cao-vo',
    title: 'Toàn Cầu Cao Võ',
    author: 'Lão Ưng Cật Tiểu Kê',
    description: 'Địa quật xâm lấn, nhân loại lâm nguy. Phương Bình trọng sinh trở lại thời điểm trước kỳ thi đại học, nhưng thế giới này không thi văn toán, mà là khảo thí võ khoa khí huyết! Nắm giữ hệ thống chuyển đổi tài phú, chỉ cần có tiền là vô địch, Phương Bình từng bước quét ngang tam giới, chấn hưng địa cầu.',
    genres: ['Đô Thị', 'Dị Năng', 'Hệ Thống'],
    coverUrl: '/covers/genre-dothi.jpg',
    rating: 4.9,
    views: 2450000,
    status: 'Hoàn thành',
    isHot: true,
    isFull: true,
    totalChapters: 1428,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Trọng sinh năm 2008',
        content: `Mùa hè năm 2008 oi ả.
Phương Bình ngơ ngác nhìn tấm bảng phấn trước lớp học cấp ba. Trên góc bảng không phải là đếm ngược thi đại học thông thường, mà là dòng chữ đỏ rực: "Cách kỳ khảo hạch Võ khoa còn 68 ngày!"`,
        createdAt: '2026-10-21T08:00:00Z',
      }
    ],
  },
  {
    id: 'pham-nhan-tu-tien',
    title: 'Phàm Nhân Tu Tiên',
    author: 'Vong Ngữ',
    description: 'Một thiếu niên bình phàm nơi sơn thôn nghèo khó, cơ duyên xảo hợp bước chân vào giang hồ rồi dấn thân vào con đường tu tiên đầy hiểm ác. Không có linh căn xuất chúng, không có bối cảnh chống lưng, chỉ dựa vào một chiếc bình nhỏ bí ẩn và tâm tính cẩn trọng như đi trên băng mỏng, Hàn Lập từng bước vấn đỉnh tiên lộ!',
    genres: ['Tiên Hiệp', 'Cổ Điển'],
    coverUrl: '/covers/genre-huyenhuyen.jpg',
    rating: 4.9,
    views: 4890000,
    status: 'Hoàn thành',
    isHot: true,
    isFull: true,
    totalChapters: 2446,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Sơn thôn thiếu niên',
        content: `Thôn Thanh Ngưu nằm sâu trong dãy núi xanh ngắt.
Hàn Lập ngồi trên tảng đá bên sườn đồi, nhìn về phía đàn dê đang gặm cỏ. Hắn mười tuổi, nước da ngăm đen vì dãi nắng dầm sương, đôi mắt sáng lộ rõ vẻ lanh lợi chất phác của đứa trẻ miền sơn cước...`,
        createdAt: '2026-10-21T08:00:00Z',
      }
    ],
  },
  {
    id: 'de-ba',
    title: 'Đế Bá',
    author: 'Yếm Bút Tiêu Sinh',
    description: 'Nuôi một con quạ, ngàn năm sau thành Tiên Đế. Trồng một gốc liễu, vạn năm sau hóa thần thụ hộ thế. Lý Thất Dạ bị cướp đoạt hồn phách giam cầm trong thân xác Âm Nha bất tử, ngao du khắp chín tầng trời vạn cổ đan dệt bố cục. Đến khi đoạt lại thân thể phàm nhân, hắn chính là truyền kỳ chí cao vô thượng!',
    genres: ['Huyền Huyễn', 'Vô Địch'],
    coverUrl: '/covers/genre-tienhiep.jpg',
    rating: 4.8,
    views: 3870000,
    status: 'Đang ra',
    isHot: true,
    isFull: false,
    totalChapters: 5120,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Tẩy Nhan Cổ Phái',
        content: `Đỉnh núi Tẩy Nhan gió lộng vi vu.
Một thiếu niên áo vải mộc mạc chắp tay sau lưng, đứng nhìn pho tượng tổ sư đã đóng rêu phong ngàn năm mà khẽ thở dài: "Năm xưa tiểu tử ngươi quỳ ba ngày ba đêm cầu ta thu nhận làm ký danh đệ tử, hôm nay đạo thống của ngươi lại suy tàn thế này sao?"`,
        createdAt: '2026-10-21T08:00:00Z',
      }
    ],
  },
  {
    id: 'toan-chuc-cao-thu',
    title: 'Toàn Chức Cao Thủ',
    author: 'Hồ Điệp Lam',
    description: 'Diệp Tu – tuyển thủ đỉnh cao sách giáo khoa của tựa game Vinh Quang bị câu lạc bộ ép buộc giải nghệ. Rời khỏi chiến đội với hai bàn tay trắng, hắn nhận việc quản lý ca đêm tại một quán net nhỏ. Với tài khoản mới "Quân Mạc Tiếu" và món vũ khí tự chế Ô Thiên Cơ, Bách Hoa Liễu Loạn một thời tái nhập giang hồ!',
    genres: ['Võng Du', 'Esports'],
    coverUrl: '/covers/genre-vongdu.jpg',
    rating: 5.0,
    views: 2950000,
    status: 'Hoàn thành',
    isHot: true,
    isFull: true,
    totalChapters: 1728,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Đêm Tuyết Rơi',
        content: `Tuyết rơi dày đặc khắp các con phố thành phố H.
Diệp Tu mặc chiếc áo khoác mỏng bước ra khỏi đại sảnh câu lạc bộ Gia Thế. Điếu thuốc lá trên môi hắn tỏa ra làn khói trắng mờ ảo giữa trời đông lạnh giá...`,
        createdAt: '2026-10-21T08:00:00Z',
      }
    ],
  },
  {
    id: 'toan-cau-bang-phong-ta-che-tao-ham-tru-an',
    title: 'Toàn Cầu Băng Phong: Ta Chế Tạo Hầm Trú Ẩn Tận Thế',
    author: 'Cửu Nhất',
    description: 'Kỷ băng hà ập đến, toàn cầu hạ nhiệt âm 70 độ C, 95% nhân loại chết cóng. Trương Dịch bị những người hàng xóm mà hắn cưu mang phản bội hãm hại đến chết. Trọng sinh trở lại trước tận thế một tháng, hắn thức sinh không gian thứ nguyên dị năng, chi trăm tỷ tích trữ hàng triệu tấn lương thực và xây dựng siêu hầm trú ẩn an toàn tuyệt đối!',
    genres: ['Mạt Thế', 'Trọng Sinh', 'Không Gian'],
    coverUrl: '/covers/genre-matthe.jpg',
    rating: 4.8,
    views: 1840000,
    status: 'Đang ra',
    isHot: true,
    isFull: false,
    totalChapters: 890,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Trở Về Trước Tận Thế',
        content: `Cơn buốt giá thấu xương và nỗi đau bị phản bội đột ngột biến mất.
Trương Dịch mở bừng mắt, nhận ra mình đang nằm trong căn hộ cao cấp ấm áp, trên bàn là ly cà phê bốc khói nghi ngút. Đồng hồ hiển thị: Ngày 25 tháng 10, đúng một tháng trước khi cơn bão tuyết hủy diệt giáng lâm!`,
        createdAt: '2026-10-21T08:00:00Z',
      }
    ],
  },
  {
    id: 'ta-o-tan-the-nhat-thuoc-tinh',
    title: 'Ta Ở Tận Thế Nhặt Thuộc Tính',
    author: 'Hắc Bào Tu Sĩ',
    description: 'Thế giới biến đổi, tang thi hoành hành. Người khác đối mặt tận thế thì run rẩy trốn chui trốn lủi, còn Dương Hạo lại thức tỉnh dị năng nhặt thuộc tính! Giết một con tang thi: rơi rớt Sức Mạnh +1, Tốc Độ +1, Tinh Thần +1. Giết quái vật biến dị: nhận được Căn Cốt Tuyệt Đỉnh! Càng đánh càng mạnh, biến tận thế thành sân chơi độc tôn.',
    genres: ['Hệ Thống', 'Mạt Thế', 'Hài Hước'],
    coverUrl: '/covers/genre-hethong.jpg',
    rating: 4.7,
    views: 1250000,
    status: 'Đang ra',
    isHot: true,
    isFull: false,
    totalChapters: 720,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Quả cầu ánh sáng thuộc tính',
        content: `Cả thành phố chìm trong tiếng gầm rú hoang dại của lũ xác sống.
Dương Hạo cầm trên tay cây chổi gãy, run rẩy đập trúng đầu một con tang thi cấp thấp. "Keng! Chúc mừng ký chủ đánh bại tang thi, rơi rớt Quả Cầu Thuộc Tính Sức Mạnh +1!"`,
        createdAt: '2026-10-21T08:00:00Z',
      }
    ],
  },
  {
    id: 'phuong-nghich-thien-ha',
    title: 'Phượng Nghịch Thiên Hạ',
    author: 'Lộ Phi',
    description: 'Sát thủ số một thế kỷ 21 Hoàng Bắc Nguyệt xuyên không nhập vào thân thể đích nữ phủ Trưởng công chúa – một phế vật yếu đuối bị gia tộc hắt hủi sỉ nhục. Mở mắt tái thế, phượng hoàng niết bàn, tay cầm thần thú vạn cổ, chân đạp thiên kiêu tứ hải. Nợ máu trả bằng máu, nàng khiến toàn bộ vương triều phải quỳ rạp dưới chân!',
    genres: ['Cổ Đại', 'Nữ Cường', 'Xuyên Không'],
    coverUrl: '/covers/genre-codai.jpg',
    rating: 4.9,
    views: 3100000,
    status: 'Hoàn thành',
    isHot: true,
    isFull: true,
    totalChapters: 1048,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Phế vật đích nữ',
        content: `Nước hồ lạnh buốt tràn vào khoang mũi.
Hoàng Bắc Nguyệt mở choàng đôi mắt sắc lẹm như chim ưng săn mồi, bàn tay nhỏ bé nhưng chứa lực đạo chí mạng túm chặt lấy cổ kẻ vừa đẩy nàng xuống nước...`,
        createdAt: '2026-10-21T08:00:00Z',
      }
    ],
  },
  {
    id: 'anh-trang-khong-bang-em',
    title: 'Ánh Trăng Không Bằng Em',
    author: 'Mạch Ngôn Xuyên',
    description: 'Năm mười bảy tuổi, Giang Tứ là đại ca ngông cuồng bất kham của trường trung học, người người kiêng dè né tránh. Nhưng chỉ trước mặt cô bạn nhỏ Tống Tĩnh với đôi mắt trong veo hiền dịu, thiếu niên kiêu ngạo ấy mới chịu buông lỏng nắm đấm, dịu dàng cúi đầu che mưa che gió cho nàng suốt một thời thanh xuân tươi đẹp.',
    genres: ['Ngôn Tình', 'Thanh Xuân', 'Chữa Lành'],
    coverUrl: '/covers/cover-tu-xuan.jpg',
    rating: 4.8,
    views: 980000,
    status: 'Hoàn thành',
    isHot: false,
    isFull: true,
    totalChapters: 86,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Mùa hè năm ấy',
        content: `Cây ngô đồng trước cổng trường xào xạc theo làn gió hạ.
Tống Tĩnh ôm chồng tập vở đi qua hành lang, bất ngờ va phải một vóc dáng cao gầy nồng đượm mùi bạc hà thoang thoảng...`,
        createdAt: '2026-10-21T08:00:00Z',
      }
    ],
  },
  {
    id: 'thu-nu-thich-hong-chuyen',
    title: 'Thứ Nữ Thích Hóng Chuyện, Cả Triều Nghe Lén Tâm Thanh',
    author: 'Cố Tiểu Đào',
    description: 'Lâm Hiền xuyên không thành thứ nữ nhỏ bé không quyền không thế ở kinh thành, sở hữu hệ thống hóng hớt drama thiên hạ. Nàng chỉ muốn nằm yên ăn dưa xem kịch, không ngờ cả Hoàng đế, Thái tử và văn võ bá quan đều nghe được tiếng lòng của nàng! Mỗi lần lên triều, cả triều đình nín thở chờ nàng bóc phốt quan viên gian xảo.',
    genres: ['Cổ Đại', 'Cung Đấu', 'Hài Hước'],
    coverUrl: '/covers/cover-trong-sinh-oan-gia.jpg',
    rating: 4.9,
    views: 1670000,
    status: 'Đang ra',
    isHot: true,
    isFull: false,
    totalChapters: 340,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Tiếng lòng lộ tẩy',
        content: `Kim Loan điện trang nghiêm tột bậc.
Lâm Hiền đứng nép sau lưng phụ thân, trong lòng vui vẻ gặm dưa: 【Ôi chao, Lễ bộ Thượng thư nhìn đạo mạo thế kia mà tối qua lén mặc váy hoa nhảy múa trong sân sau kìa!】
Ầm! Toàn thể đại thần đồng loạt nghẹn thở, Hoàng đế suýt chút nữa phun ngụm trà trên long ỷ!`,
        createdAt: '2026-10-21T08:00:00Z',
      }
    ],
  },
  {
    id: 'thap-nien-80-thien-kim-that-hieu-thu-ngu',
    title: 'Thập Niên 80: Thiên Kim Thật Hiểu Thú Ngữ',
    author: 'Tống Minh Đường',
    description: 'Bị tráo đổi thân phận từ nhỏ, thiên kim thật Lâm Vãn trở về đại viện nhà họ Tạ trong sự ghẻ lạnh của cha mẹ và mỉa mai của thiên kim giả. Nhưng họ không ngờ, Lâm Vãn có khả năng nghe hiểu tiếng nói của muôn loài động vật! Chim sẻ báo tin đối thủ giở trò, chó săn dẫn đường đào cổ vật, gấu lớn hộ tống lên núi hái linh chi. Nàng tự lập tự cường, dẫn dắt đại gia đình vươn lên thành hào môn!',
    genres: ['Trọng Sinh', 'Đô Thị', 'Điền Văn'],
    coverUrl: '/covers/genre-dothi.jpg',
    rating: 4.8,
    views: 1420000,
    status: 'Hoàn thành',
    isHot: true,
    isFull: true,
    totalChapters: 412,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Trở về đại viện',
        content: `Tiếng còi xe lửa kéo dài đánh thức Lâm Vãn.
Chiếc vali da sờn rách đặt bên chân, nàng ngẩng đầu nhìn cổng lớn đại viện quen thuộc kiếp trước mà khóe môi khẽ cong lên một nụ cười lạnh lùng...`,
        createdAt: '2026-10-21T08:00:00Z',
      }
    ],
  },
  {
    id: 'thon-phe-tinh-khong',
    title: 'Thôn Phệ Tinh Không',
    author: 'Ngã Cật Tây Hồng Thị',
    description: 'Sau thảm họa virus RR, địa cầu bước vào kỷ nguyên đại niết bàn với muôn vàn quái thú cuồng bạo. Thiếu niên La Phong nuôi mộng trở thành chiến binh võ giả để bảo vệ gia đình. Nhận được truyền thừa từ nền văn minh vũ trụ vẫn lạc, La Phong dấn thân vào vũ trụ tinh hải mênh mông, thôn phệ thú vạn giới, bảo vệ tinh cầu quê hương.',
    genres: ['Khoa Huyễn', 'Dị Năng'],
    coverUrl: '/covers/genre-vongdu.jpg',
    rating: 4.9,
    views: 4200000,
    status: 'Hoàn thành',
    isHot: true,
    isFull: true,
    totalChapters: 1488,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Thiếu niên La Phong',
        content: `Thành phố Giang Nam căn cứ thị, khu Nghi An.
Ánh hoàng hôn buông xuống những tòa chung cư cao tầng kiên cố được bao bọc bởi tường thành phòng thủ chống quái thú...`,
        createdAt: '2026-10-21T08:00:00Z',
      }
    ],
  },
  {
    id: 'dao-gioi-thien-ha',
    title: 'Đạo Giới Thiên Hạ',
    author: 'Dạ Hành Cẩu',
    description: 'Đạo là gì? Đạo là quy luật thiên địa, là đại đạo chí giản. Khương Vân xuất thân từ thôn xóm hẻo lánh Man Hoang, mang trong mình dòng máu Thập Tộc bí ẩn. Vì cứu vớt gia tộc và người thân, hắn dấn thân vào con đường tu đạo nghịch thiên, một thương phá vỡ ngàn trùng giới vực!',
    genres: ['Tiên Hiệp', 'Kiếm Hiệp'],
    coverUrl: '/covers/cover-tien-ma.jpg',
    rating: 4.8,
    views: 2190000,
    status: 'Đang ra',
    isHot: false,
    isFull: false,
    totalChapters: 3800,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Man Hoang Thôn Lạc',
        content: `Trong thung lũng mờ mịt sương mù nơi Man Hoang hoang dã.
Khương Vân ngồi xếp bằng bên bờ suối đá, hít thở từng luồng linh khí đất trời mát lành chảy vào đan điền...`,
        createdAt: '2026-10-21T08:00:00Z',
      }
    ],
  },
  {
    id: 'ma-duoc-dai-de',
    title: 'Ma Dược Đại Đế: Bắt Đầu Từ Dược Đồng',
    author: 'Thiên Hỏa Luyện Tâm',
    description: 'Chuyển sinh thành dược đồng bị đày ải ở Đan Hà Tông, Lâm Mặc nắm giữ Thần Nông Đỉnh có thể thôi diễn vạn loại linh thảo và hoàn thiện đan phương thần thoại. Từ một đệ tử quét dọn lò luyện, hắn từng bước tinh luyện cửu chuyển thánh đan, trấn áp vạn tộc đan vương!',
    genres: ['Huyền Huyễn', 'Luyện Đan'],
    coverUrl: '/covers/cover-vinh-hang.jpg',
    rating: 4.7,
    views: 1120000,
    status: 'Đang ra',
    isHot: false,
    isFull: false,
    totalChapters: 640,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Lò đan phế liệu',
        content: `Mùi khét của tro tàn thảo dược bốc lên nồng nặc trong phòng bếp đan viện.
Lâm Mặc phủi sạch tàn tro bám trên mặt, cúi nhìn lòng bàn tay nơi một vết bớt hình chiếc đỉnh cổ màu đồng đang tỏa ra hơi ấm dịu dàng...`,
        createdAt: '2026-10-21T08:00:00Z',
      }
    ],
  },
  {
    id: 'ha-canh-ben-em',
    title: 'Hạ Cánh Nơi Em',
    author: 'Park Ji Eun',
    description: 'Một tai nạn dù lượn bất ngờ đưa nữ tài phiệt thời trang Yoon Se-ri hạ cánh sang bờ bên kia giới tuyến. Cuộc gặp gỡ định mệnh với chàng đại úy quân nhân Ri Jeong-hyeok mở ra câu chuyện tình yêu vượt qua mọi ranh giới địa lý, hiểm nguy và định kiến.',
    genres: ['Ngôn Tình', 'Đô Thị'],
    coverUrl: '/covers/tong-tai-co-chap.jpg',
    rating: 4.9,
    views: 1890000,
    status: 'Hoàn thành',
    isHot: false,
    isFull: true,
    totalChapters: 68,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Cơn lốc xoáy định mệnh',
        content: `Bầu trời trong xanh bỗng chốc tối sầm bởi cơn lốc xoáy dị thường.
Yoon Se-ri chới với giữa tầng mây mờ mịt, chiếc dù lượn màu hồng bị cuốn phăng vào vùng rừng rậm biên giới chưa từng đặt chân đến...`,
        createdAt: '2026-10-21T08:00:00Z',
      }
    ],
  },
  {
    id: 'ngoan-ngoan-dung-yen-cho-anh-den',
    title: 'Ngoan Ngoãn Đứng Yên Chờ Anh Đến',
    author: 'Cố Tây Quyết',
    description: 'Ảnh đế lạnh lùng kiêu hãnh Lục Thiệu Trầm vốn có tiếng là người cấm dục cách biệt mọi nữ nhân trong giới giải trí. Cho đến một ngày, phóng viên bắt gặp hắn kiên nhẫn đứng dưới mưa nửa giờ đồng hồ chỉ để che ô và cột lại dây giày cho cô nàng diễn viên lồng tiếng bé nhỏ Thẩm Niệm Niệm.',
    genres: ['Ngôn Tình', 'Giới Giải Trí'],
    coverUrl: '/covers/nu-phu-phan-cong.jpg',
    rating: 4.8,
    views: 1340000,
    status: 'Hoàn thành',
    isHot: false,
    isFull: true,
    totalChapters: 92,
    updatedAt: new Date().toISOString(),
    isPublic: true,
    approvalStatus: 'approved',
    chapters: [
      {
        id: 'chuong-1',
        chapterNumber: 1,
        title: 'Chương 1: Phòng thu âm số 3',
        content: `Đèn hiệu "ON AIR" màu đỏ rực sáng ngoài cửa phòng thu.
Thẩm Niệm Niệm đeo tai nghe kiểm âm, giọng nói ngọt ngào ấm áp vang lên trong micro. Phía sau lớp kính cách âm hai lớp, Lục Thiệu Trầm khẽ nhướng mày dừng bước...`,
        createdAt: '2026-10-21T08:00:00Z',
      }
    ],
  },
];

function ensureNovelHasFullChapters(novel: FallbackNovel): FallbackNovel {
  if (!novel.chapters || novel.chapters.length < 10 || (novel.chapters[0]?.content?.length || 0) < 300) {
    const fullChapters = generateChaptersForNovel({
      id: novel.id,
      title: novel.title,
      author: novel.author,
      description: novel.description,
      genres: novel.genres,
    }, 15);
    return {
      ...novel,
      chapters: fullChapters,
    };
  }
  return novel;
}

export const FALLBACK_NOVELS: FallbackNovel[] = BASE_FALLBACK_NOVELS.map(ensureNovelHasFullChapters);

export function getFallbackNovel(slug?: string): FallbackNovel {
  if (!slug) return ensureNovelHasFullChapters(FALLBACK_NOVELS[0]);
  const raw = slug.trim();
  const normalized = raw.toLowerCase();
  
  // 1. Exact match by ID or slug
  const direct = FALLBACK_NOVELS.find(n => n.id === normalized || n.id === raw || (n as any).slug === normalized || (n as any).slug === raw);
  if (direct) return ensureNovelHasFullChapters(direct);

  // 2. Partial match by slug prefix / contains / title
  const partial = FALLBACK_NOVELS.find(n => 
    n.id.startsWith(normalized) || 
    normalized.startsWith(n.id) || 
    (n.title && n.title.toLowerCase().includes(normalized))
  );
  if (partial) return ensureNovelHasFullChapters(partial);

  // 3. Fallback to deterministic novel by hashing slug (prevents 404 on any Firestore auto-ID or unknown slug)
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  const fallbackIdx = Math.abs(hash) % FALLBACK_NOVELS.length;
  return ensureNovelHasFullChapters(FALLBACK_NOVELS[fallbackIdx]);
}

export function getFallbackChapter(slug: string, chapterId: string): { novel: FallbackNovel; chapter: FallbackChapter } {
  const novel = getFallbackNovel(slug);

  // Find exact chapter id
  let chap = novel.chapters.find(c => c.id === chapterId);
  if (!chap) {
    const num = parseInt(chapterId.replace(/\D/g, ''), 10);
    if (!isNaN(num)) {
      chap = novel.chapters.find(c => c.chapterNumber === num);
    }
  }

  // If still not found, fallback to first chapter
  if (!chap && novel.chapters.length > 0) {
    chap = novel.chapters[0];
  }

  if (!chap) {
    const synthesized = generateChaptersForNovel(novel, 5);
    chap = synthesized[0];
  }

  return { novel, chapter: chap };
}
